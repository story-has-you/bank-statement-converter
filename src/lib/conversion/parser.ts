import "server-only";

import { conversionLimits, MAX_RESPONSE_BYTES } from "@/config/conversion";

import { subscriptionConfig } from "@/config/plans";
import type { MembershipTier } from "@/lib/billing/types";
import { isParseResponse, type ParseResponse } from "@/lib/conversion-types";
import { ConversionError } from "@/lib/conversion-errors";

export { MAX_RESPONSE_BYTES } from "@/config/conversion";

export function canUseQwen(tier: MembershipTier | undefined): boolean {
  return tier !== undefined && subscriptionConfig[tier].qwenFallback;
}

export function shouldFallback(error: ConversionError): boolean {
  const terminalCodes = [
    "INVALID_REQUEST",
    "INVALID_FILE",
    "MISSING_FILE",
    "EMPTY_FILE",
    "INVALID_FILE_TYPE",
    "INVALID_PDF",
    "PASSWORD_PROTECTED_PDF",
    "FILE_TOO_LARGE",
    "TOO_MANY_PAGES",
    "PARSER_RESPONSE_TOO_LARGE",
  ];
  if (terminalCodes.includes(error.code) || error.code.startsWith("QUOTA_")) {
    return false;
  }
  return (
    error.status >= 500 ||
    [
      "UNAUTHORIZED",
      "PARSER_NOT_CONFIGURED",
      "PARSER_AUTH_NOT_CONFIGURED",
      "PARSER_TIMEOUT",
      "PARSER_UNAVAILABLE",
      "INVALID_PARSER_RESPONSE",
      "PARSER_RESPONSE_UNREADABLE",
      "UNSUPPORTED_SCANNED_PDF",
      "TABLE_NOT_FOUND",
      "NO_VERIFIABLE_TRANSACTIONS",
      "PARSE_FAILED",
    ].includes(error.code)
  );
}

export function requireUsableResult(value: unknown): ParseResponse {
  if (!isParseResponse(value) || value.pageCount < 1) {
    throw new ConversionError("INVALID_PARSER_RESPONSE");
  }
  if (value.pageCount > conversionLimits.pages) {
    throw new ConversionError("TOO_MANY_PAGES", 413);
  }
  if (value.summary.status === "failed" || value.summary.validRowCount + value.summary.warningRowCount === 0) {
    throw new ConversionError("NO_VERIFIABLE_TRANSACTIONS", 422);
  }
  return value;
}

export async function parseWithPython(file: File, signal: AbortSignal): Promise<ParseResponse> {
  const secret = process.env.PARSER_SHARED_SECRET?.trim();
  if (!secret) {
    throw new ConversionError("PARSER_NOT_CONFIGURED", 503);
  }
  const baseUrl = (process.env.PARSER_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const body = new FormData();
  body.append("file", file);
  const timeout = AbortSignal.timeout(55_000);
  const upstreamSignal = AbortSignal.any([signal, timeout]);
  try {
    const response = await fetch(`${baseUrl}/parse`, {
      method: "POST",
      body,
      cache: "no-store",
      headers: { Authorization: `Bearer ${secret}` },
      signal: upstreamSignal,
    });
    const reader = response.body?.getReader();
    if (!reader) {
      throw new ConversionError("PARSER_RESPONSE_UNREADABLE");
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          throw new ConversionError("PARSER_RESPONSE_TOO_LARGE");
        }
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new ConversionError("INVALID_PARSER_RESPONSE", response.ok ? 502 : response.status);
    }
    if (!response.ok) {
      const code =
        typeof payload === "object" && payload !== null && "code" in payload && typeof payload.code === "string"
          ? payload.code
          : "INVALID_PARSER_RESPONSE";
      throw new ConversionError(code, response.status);
    }
    return requireUsableResult(payload);
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof ConversionError) {
      throw error;
    }
    if (timeout.aborted) {
      throw new ConversionError("PARSER_TIMEOUT");
    }
    throw new ConversionError("PARSER_UNAVAILABLE");
  }
}
