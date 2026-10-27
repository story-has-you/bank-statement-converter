import "server-only";

import { after } from "next/server";

import { ConversionError } from "@/lib/conversion-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UsageActor } from "@/lib/usage/server";

export type ConversionParseRecord = {
  user_id: string;
  email: string | null;
  parse_method: "llm";
  status: "success" | "partial" | "failed" | "cancelled";
  error_code: string | null;
};

const finalErrorCodes = new Set([
  "PARSER_RESPONSE_TOO_LARGE",
  "INVALID_PARSER_RESPONSE",
  "NO_VERIFIABLE_TRANSACTIONS",
  "TOO_MANY_PAGES",
  "QUOTA_EXCEEDED",
  "QUOTA_EXHAUSTED",
  "QUOTA_UNAVAILABLE",
  "QUOTA_RECORD_FAILED",
  "QUOTA_PERIOD_UNAVAILABLE",
  "QWEN_NOT_CONFIGURED",
  "QWEN_UNAVAILABLE",
  "QWEN_TIMEOUT",
  "INVALID_QWEN_RESPONSE",
  "QWEN_RESPONSE_TOO_LARGE",
  "QWEN_PAGE_COUNT_UNAVAILABLE",
  "QWEN_INCOMPLETE_RESPONSE",
]);

export function createParseRecord(actor: UsageActor): ConversionParseRecord | null {
  if (actor.type !== "user") {
    return null;
  }
  return {
    user_id: actor.key,
    email: actor.email,
    parse_method: "llm",
    status: "failed",
    error_code: null,
  };
}

export function getParseErrorCode(error: unknown): string {
  if (error instanceof ConversionError && finalErrorCodes.has(error.code)) {
    return error.code;
  }
  return "UNKNOWN";
}

export function scheduleParseRecord(record: ConversionParseRecord): void {
  // Snapshot only metadata; background work must not retain the file or transaction result.
  const snapshot = { ...record };
  try {
    after(async () => {
      try {
        const admin = createAdminClient();
        if (!admin) {
          console.error("Conversion parse record failed", { code: "PARSE_RECORD_UNAVAILABLE" });
          return;
        }
        const { error } = await admin.from("conversion_parse_records").insert(snapshot);
        if (error) {
          // PostgREST details and messages can contain row values; log only a recognized code format.
          const databaseCode = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error.code) ? error.code : "UNKNOWN";
          console.error("Conversion parse record failed", { code: "PARSE_RECORD_FAILED", databaseCode });
        }
      } catch {
        console.error("Conversion parse record failed", { code: "PARSE_RECORD_FAILED" });
      }
    });
  } catch {
    console.error("Conversion parse record scheduling failed", { code: "PARSE_RECORD_SCHEDULE_FAILED" });
  }
}
