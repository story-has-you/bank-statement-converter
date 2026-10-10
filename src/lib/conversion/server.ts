import { ConversionError } from "@/lib/conversion-errors";
import {
  emitParsedTables,
  type EmitConversionEvent,
} from "@/lib/conversion-events";
import type { ParseResponse } from "@/lib/conversion-types";
import { parseWithQwen } from "@/lib/qwen/parser";
import { consumeConversionQuota, type QuotaContext } from "@/lib/usage/server";
import { MAX_RESPONSE_BYTES, parseWithPython, shouldFallback } from "./parser";

export async function convertStatement(
  file: File,
  context: QuotaContext,
  allowQwen: boolean,
  signal: AbortSignal,
  emit: EmitConversionEvent,
): Promise<ParseResponse> {
  signal.throwIfAborted();
  emit({ type: "status", data: { stage: "reading" } });
  const result = await parseStatement(file, allowQwen, signal, emit);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_RESPONSE_BYTES) {
    throw new ConversionError("PARSER_RESPONSE_TOO_LARGE");
  }
  signal.throwIfAborted();
  emit({ type: "status", data: { stage: "finalizing" } });
  let quota;
  try {
    quota = await consumeConversionQuota(context, result.pageCount);
  } catch {
    throw new ConversionError("QUOTA_RECORD_FAILED", 503);
  }
  if (!quota.allowed) {
    throw new ConversionError(
      quota.remainingPages === 0 ? "QUOTA_EXHAUSTED" : "QUOTA_EXCEEDED",
      429,
      {
        period: quota.period,
        usedPages: quota.usedPages,
        remainingPages: quota.remainingPages,
        limitPages: quota.limitPages,
      },
    );
  }
  const { schemaVersion, filename, pageCount, summary, errors } = result;
  const data = { schemaVersion, filename, pageCount, summary, errors };
  emit({ type: "complete", data });
  return result;
}

async function parseStatement(
  file: File,
  allowQwen: boolean,
  signal: AbortSignal,
  emit: EmitConversionEvent,
): Promise<ParseResponse> {
  let result: ParseResponse;
  try {
    result = await parseWithPython(file, signal);
  } catch (error) {
    signal.throwIfAborted();
    if (!allowQwen || !(error instanceof ConversionError) || !shouldFallback(error)) throw error;
    emit({ type: "status", data: { stage: "extracting" } });
    return parseWithQwen(file, signal, emit);
  }

  emitParsedTables(result, emit);
  return result;
}
