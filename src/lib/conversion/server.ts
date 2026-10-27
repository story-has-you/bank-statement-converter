import "server-only";

import { after } from "next/server";

import { ConversionError } from "@/lib/conversion-errors";
import type { EmitConversionEvent } from "@/lib/conversion-events";
import type { ParseResponse } from "@/lib/conversion-types";
import { parseWithQwen } from "@/lib/qwen/parser";
import { consumeConversionQuota, type QuotaContext } from "@/lib/usage/server";
import { MAX_RESPONSE_BYTES } from "@/config/conversion";
import { createParseRecord, getParseErrorCode, scheduleParseRecord } from "./records";

export async function convertStatement(
  file: File,
  context: QuotaContext,
  signal: AbortSignal,
  emit: EmitConversionEvent,
  availablePages: number,
): Promise<ParseResponse> {
  signal.throwIfAborted();
  emit({ type: "status", data: { stage: "reading" } });
  const record = createParseRecord(context);
  try {
    emit({ type: "status", data: { stage: "extracting" } });
    const result = await parseWithQwen(file, signal, emit);
    const responseBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
    if (responseBytes > MAX_RESPONSE_BYTES) {
      throw new ConversionError("PARSER_RESPONSE_TOO_LARGE");
    }
    signal.throwIfAborted();
    emit({ type: "status", data: { stage: "finalizing" } });
    if (result.pageCount > availablePages) {
      throw new ConversionError(availablePages === 0 ? "QUOTA_EXHAUSTED" : "QUOTA_EXCEEDED", 429, {
        period: context.window.period,
        usedPages: context.limitPages - availablePages,
        remainingPages: availablePages,
        limitPages: context.limitPages,
      });
    }
    scheduleQuotaConsumption(context, result.pageCount);
    const { schemaVersion, filename, pageCount, summary, errors } = result;
    const data = { schemaVersion, filename, pageCount, summary, errors };
    emit({ type: "complete", data });
    if (record) {
      record.status = result.summary.status;
    }
    return result;
  } catch (error) {
    if (record) {
      record.status = signal.aborted ? "cancelled" : "failed";
      record.error_code = signal.aborted ? null : getParseErrorCode(error);
    }
    throw error;
  } finally {
    if (record) {
      scheduleParseRecord(record);
    }
  }
}

function scheduleQuotaConsumption(context: QuotaContext, pageCount: number): void {
  // Keep background work alive after the response; capture no PDF or transaction result.
  after(async () => {
    try {
      const quota = await consumeConversionQuota(context, pageCount);
      if (quota.status === "exceeded") {
        console.error("Conversion quota deduction rejected", { code: "QUOTA_EXCEEDED" });
      }
    } catch {
      console.error("Conversion quota deduction failed", { code: "QUOTA_RECORD_FAILED" });
    }
  });
}
