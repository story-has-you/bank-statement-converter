import "server-only";

import { ConversionError } from "@/lib/conversion-errors";
import type { EmitConversionEvent } from "@/lib/conversion-events";
import type { ParseResponse } from "@/lib/conversion-types";
import { parseWithQwen } from "@/lib/qwen/parser";
import { consumeConversionQuota, releaseAiQuota, type QuotaContext } from "@/lib/usage/server";
import { MAX_RESPONSE_BYTES } from "@/config/conversion";
import { createParseRecord, getParseErrorCode, scheduleParseRecord } from "./records";

export async function convertStatement(
  file: File,
  context: QuotaContext,
  signal: AbortSignal,
  emit: EmitConversionEvent,
  pageCount: number,
): Promise<ParseResponse> {
  signal.throwIfAborted();
  emit({ type: "status", data: { stage: "reading" } });
  const record = createParseRecord(context);
  let reserved = false;
  try {
    let quota;
    try {
      quota = await consumeConversionQuota(context, pageCount, "llm");
    } catch {
      throw new ConversionError("QUOTA_RECORD_FAILED", 503);
    }
    if (quota.status === "stale") {
      throw new ConversionError("QUOTA_PERIOD_UNAVAILABLE", 503);
    }
    if (!quota.allowed) {
      let code = quota.remainingPages === 0 ? "QUOTA_EXHAUSTED" : "QUOTA_EXCEEDED";
      if (pageCount <= quota.remainingPages) {
        code = quota.remainingAiPages === 0 ? "AI_QUOTA_EXHAUSTED" : "AI_QUOTA_EXCEEDED";
      }
      throw new ConversionError(code, 429, quota);
    }
    // shortcut: a process exit can leave reserved pages charged; add durable jobs if automatic crash recovery is needed.
    reserved = true;
    signal.throwIfAborted();
    emit({ type: "status", data: { stage: "extracting" } });
    const result = await parseWithQwen(file, signal, emit);
    if (result.pageCount !== pageCount) {
      throw new ConversionError("INVALID_PARSER_RESPONSE");
    }
    const responseBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
    if (responseBytes > MAX_RESPONSE_BYTES) {
      throw new ConversionError("PARSER_RESPONSE_TOO_LARGE");
    }
    signal.throwIfAborted();
    emit({ type: "status", data: { stage: "finalizing" } });
    const { schemaVersion, filename, summary, errors } = result;
    const data = { schemaVersion, filename, pageCount, summary, errors };
    emit({ type: "complete", data });
    if (record) {
      record.status = result.summary.status;
    }
    return result;
  } catch (error) {
    if (reserved) {
      try {
        await releaseAiQuota(context, pageCount);
      } catch {
        console.error("AI quota refund failed", { code: "QUOTA_REFUND_FAILED" });
      }
    }
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
