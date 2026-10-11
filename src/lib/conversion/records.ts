import { after } from "next/server";

import { ConversionError } from "@/lib/conversion-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UsageActor } from "@/lib/usage/server";

type LlmTriggerCategory = "parsing" | "service" | "response" | "unknown";

export type ConversionParseRecord = {
  user_id: string;
  email: string | null;
  parse_method: "code" | "llm";
  status: "success" | "partial" | "failed" | "cancelled";
  python_error_code: string | null;
  python_error_reason: string | null;
  llm_trigger_category: LlmTriggerCategory | null;
  error_code: string | null;
};

// Internal diagnostic descriptions only; never sent to the public conversion API.
const pythonFailures: Record<string, { reason: string; category: LlmTriggerCategory }> = {
  UNSUPPORTED_SCANNED_PDF: { reason: "未能提取到文字，可能为扫描件。", category: "parsing" },
  TABLE_NOT_FOUND: { reason: "未识别到可用的银行流水表格。", category: "parsing" },
  NO_VERIFIABLE_TRANSACTIONS: { reason: "没有识别出日期、描述和金额均可核对的交易行。", category: "parsing" },
  PARSE_FAILED: { reason: "Python 服务未能完成解析，具体内部原因未知。", category: "service" },
  PARSER_TIMEOUT: { reason: "Python 解析请求超时。", category: "service" },
  PARSER_UNAVAILABLE: { reason: "无法连接 Python 解析服务。", category: "service" },
  PARSER_NOT_CONFIGURED: { reason: "Next.js 未配置 Python 解析服务鉴权。", category: "service" },
  PARSER_AUTH_NOT_CONFIGURED: { reason: "Python 解析服务未配置鉴权。", category: "service" },
  UNAUTHORIZED: { reason: "Python 解析服务拒绝鉴权。", category: "service" },
  INVALID_PARSER_RESPONSE: { reason: "Python 解析服务返回的数据不符合结果契约。", category: "response" },
  PARSER_RESPONSE_UNREADABLE: { reason: "无法完整读取 Python 解析服务的响应。", category: "response" },
  PARSER_RESPONSE_TOO_LARGE: { reason: "Python 解析结果超过响应大小限制。", category: "response" },
  INVALID_REQUEST: { reason: "Python 解析服务无法读取请求。", category: "parsing" },
  INVALID_FILE: { reason: "Python 解析服务未收到有效文件。", category: "parsing" },
  MISSING_FILE: { reason: "Python 解析服务未收到文件。", category: "parsing" },
  EMPTY_FILE: { reason: "PDF 文件为空。", category: "parsing" },
  INVALID_FILE_TYPE: { reason: "上传文件不是 PDF。", category: "parsing" },
  INVALID_PDF: { reason: "PDF 无效或无法读取。", category: "parsing" },
  PASSWORD_PROTECTED_PDF: { reason: "PDF 受密码保护。", category: "parsing" },
  FILE_TOO_LARGE: { reason: "PDF 超过文件大小限制。", category: "parsing" },
  TOO_MANY_PAGES: { reason: "PDF 超过页数限制。", category: "parsing" },
  UNKNOWN: { reason: "Python 阶段失败，具体原因未知。", category: "unknown" },
};

const finalErrorCodes = new Set([
  ...Object.keys(pythonFailures),
  "QUOTA_EXCEEDED", "QUOTA_EXHAUSTED", "QUOTA_UNAVAILABLE", "QUOTA_RECORD_FAILED", "QUOTA_PERIOD_UNAVAILABLE",
  "QWEN_NOT_CONFIGURED", "QWEN_UNAVAILABLE", "QWEN_TIMEOUT", "INVALID_QWEN_RESPONSE",
  "QWEN_RESPONSE_TOO_LARGE", "QWEN_PAGE_COUNT_UNAVAILABLE", "QWEN_INCOMPLETE_RESPONSE",
]);

export function createParseRecord(actor: UsageActor): ConversionParseRecord | null {
  if (actor.type !== "user") return null;
  return {
    user_id: actor.key,
    email: actor.email,
    parse_method: "code",
    status: "failed",
    python_error_code: null,
    python_error_reason: null,
    llm_trigger_category: null,
    error_code: null,
  };
}

export function getParseErrorCode(error: unknown): string {
  if (error instanceof ConversionError && finalErrorCodes.has(error.code)) return error.code;
  return "UNKNOWN";
}

export function recordPythonFailure(record: ConversionParseRecord, error: unknown): void {
  const code = error instanceof ConversionError && Object.hasOwn(pythonFailures, error.code) ? error.code : "UNKNOWN";
  record.python_error_code = code;
  record.python_error_reason = pythonFailures[code].reason;
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

export function recordLlmFallback(record: ConversionParseRecord): void {
  record.parse_method = "llm";
  const code = record.python_error_code ?? "UNKNOWN";
  record.llm_trigger_category = pythonFailures[code].category;
}
