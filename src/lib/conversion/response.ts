import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import type { AppConfig } from "next-intl";

import { conversionLimits } from "@/config/conversion";
import type { AppLocale } from "@/i18n/routing";
import { ConversionError, type ConversionErrorPayload } from "@/lib/conversion-errors";
import type { ConversionEvent } from "@/lib/conversion-events";
import type { QuotaContext } from "@/lib/usage/server";
import { convertStatement } from "./server";

type ApiErrorCode = keyof AppConfig["Messages"]["ApiErrors"];

async function errorPayload(
  code: string,
  locale: AppLocale,
  quota?: Omit<ConversionErrorPayload, "code" | "message">,
): Promise<ConversionErrorPayload> {
  const t = await getTranslations({ locale, namespace: "ApiErrors" });
  const publicCode = code.replaceAll("QWEN", "LLM");
  const key: ApiErrorCode = t.has(publicCode as ApiErrorCode) ? publicCode as ApiErrorCode : "UNKNOWN";
  return { code: publicCode, message: t(key, conversionLimits), ...quota };
}

export async function errorResponse(
  code: string,
  status: number,
  locale: AppLocale,
  quota?: Omit<ConversionErrorPayload, "code" | "message">,
): Promise<NextResponse<ConversionErrorPayload>> {
  return NextResponse.json(await errorPayload(code, locale, quota), { status });
}

function asConversionError(error: unknown): ConversionError {
  return error instanceof ConversionError ? error : new ConversionError("UNKNOWN", 500);
}

export async function createConversionResponse(
  request: Request,
  file: File,
  context: QuotaContext,
  allowQwen: boolean,
  locale: AppLocale,
  availablePages: number,
): Promise<NextResponse> {
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return streamResponse(request, file, context, allowQwen, locale, availablePages);
  }
  try {
    const result = await convertStatement(file, context, allowQwen, request.signal, () => {}, availablePages);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store", Vary: "Accept" } });
  } catch (error) {
    const failure = asConversionError(error);
    return errorResponse(failure.code, failure.status, locale, failure.quota);
  }
}

function streamResponse(
  request: Request,
  file: File,
  context: QuotaContext,
  allowQwen: boolean,
  locale: AppLocale,
  availablePages: number,
): NextResponse {
  const abort = new AbortController();
  const signal = AbortSignal.any([request.signal, abort.signal]);
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: ConversionEvent): void {
        if (!closed && !signal.aborted) {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`));
        }
      }
      const heartbeat = setInterval(() => {
        if (!closed && !signal.aborted) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);
      try {
        await convertStatement(file, context, allowQwen, signal, send, availablePages);
      } catch (error) {
        if (!signal.aborted) {
          const failure = asConversionError(error);
          const data = await errorPayload(failure.code, locale, failure.quota);
          send({ type: "error", data });
        }
      } finally {
        clearInterval(heartbeat);
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; abort.abort(); },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      Vary: "Accept",
    },
  });
}
