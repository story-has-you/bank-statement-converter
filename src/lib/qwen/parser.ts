import { conversionLimits } from "@/config/conversion";

import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";

import { ConversionError } from "@/lib/conversion-errors";
import type { EmitConversionEvent } from "@/lib/conversion-events";
import type { ParseResponse } from "@/lib/conversion-types";
import { QwenJsonStream } from "./json-stream";
import { statementPrompt } from "./prompt";

function getPdfPageCount(usage: unknown): number | null {
  if (typeof usage !== "object" || usage === null || !("x_tools" in usage)) return null;
  const tools = usage.x_tools;
  if (typeof tools !== "object" || tools === null || !("pdf_page_parser" in tools)) return null;
  const parser = tools.pdf_page_parser;
  if (typeof parser !== "object" || parser === null || !("count" in parser)) return null;
  return typeof parser.count === "number" && Number.isInteger(parser.count) && parser.count > 0 ? parser.count : null;
}

export async function parseWithQwen(file: File, signal: AbortSignal, emit: EmitConversionEvent): Promise<ParseResponse> {
  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) throw new ConversionError("QWEN_NOT_CONFIGURED", 503);
  const timeout = AbortSignal.timeout(230_000);
  const upstreamSignal = AbortSignal.any([signal, timeout]);
  const openai = new OpenAI({ apiKey, baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1", maxRetries: 0, timeout: 230_000 });
  const body: ChatCompletionCreateParamsStreaming & { include_tool_usage: boolean; enable_thinking: boolean } = {
    model: "qwen3.8-flash",
    stream: true,
    response_format: { type: "json_object" },
    stream_options: { include_usage: true },
    include_tool_usage: true,
    enable_thinking: false,
    messages: [
      { role: "system", content: statementPrompt },
      {
        role: "user",
        content: [
          { type: "file", file: { filename: file.name, file_data: `data:application/pdf;base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` } },
          { type: "text", text: "Extract every reviewable bank statement transaction as JSON using the specified contract." },
        ],
      },
    ],
  };
  const parser = new QwenJsonStream(emit);
  let pageCount: number | null = null;
  let finished = false;
  try {
    const stream = await openai.chat.completions.create(body, { signal: upstreamSignal });
    for await (const chunk of stream) {
      upstreamSignal.throwIfAborted();
      if (chunk.usage) {
        pageCount = getPdfPageCount(chunk.usage);
        if (pageCount !== null && pageCount > conversionLimits.pages) throw new ConversionError("TOO_MANY_PAGES", 413);
      }
      for (const choice of chunk.choices) {
        if (choice.index !== 0) continue;
        if (choice.delta.refusal) throw new ConversionError("INVALID_QWEN_RESPONSE");
        if (choice.delta.content) parser.write(choice.delta.content);
        if (choice.finish_reason != null) {
          if (choice.finish_reason === "length") {
            throw new ConversionError("QWEN_INCOMPLETE_RESPONSE", 502, undefined, "output_limit");
          }
          if (choice.finish_reason !== "stop") throw new ConversionError("INVALID_QWEN_RESPONSE", 502, undefined, "finish_reason");
          finished = true;
        }
      }
    }
    if (!finished) throw new ConversionError("QWEN_INCOMPLETE_RESPONSE", 502, undefined, "missing_finish");
    if (pageCount === null) throw new ConversionError("QWEN_PAGE_COUNT_UNAVAILABLE");
    return parser.finish(file.name, pageCount);
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof ConversionError) {
      console.error("Qwen conversion rejected", { code: error.code, reason: error.diagnostic ?? "validation" });
      throw error;
    }
    if (timeout.aborted || error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new ConversionError("QWEN_TIMEOUT", 504);
    }
    // Do not log SDK errors: they may include request bodies or provider responses.
    throw new ConversionError("QWEN_UNAVAILABLE", 503);
  }
}
