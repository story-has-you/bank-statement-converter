import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isParseResponse } from "@/lib/conversion-types";
import {
  consumeConversionQuota,
  createAnonymousId,
  getEntitledSubscription,
  getQuotaContext,
  getUsageRecord,
  hashAnonymousId,
  isUsageRecordCurrent,
  type UsageActor,
  type QuotaContext,
  SubscriptionPeriodUnavailableError,
  UsageUnavailableError,
} from "@/lib/usage/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestLocale } from "@/i18n/locale";
import type { AppLocale } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

type ErrorPayload = {
  code: string;
  message: string;
  period?: "day" | "month";
  usedPages?: number;
  remainingPages?: number;
  limitPages?: number;
};

const ANONYMOUS_COOKIE = "bank-statement-converter-anonymous";
const apiErrorCodes = [
  "INVALID_REQUEST",
  "INVALID_FILE",
  "MISSING_FILE",
  "EMPTY_FILE",
  "PARSER_UNAVAILABLE",
  "PARSER_NOT_CONFIGURED",
  "PARSER_TIMEOUT",
  "INVALID_PARSER_RESPONSE",
  "PARSER_RESPONSE_UNREADABLE",
  "PARSER_AUTH_NOT_CONFIGURED",
  "UNAUTHORIZED",
  "QUOTA_EXCEEDED",
  "QUOTA_EXHAUSTED",
  "QUOTA_UNAVAILABLE",
  "QUOTA_RECORD_FAILED",
  "QUOTA_PERIOD_UNAVAILABLE",
  "FILE_TOO_LARGE",
  "PARSER_RESPONSE_TOO_LARGE",
  "INVALID_FILE_TYPE",
  "INVALID_PDF",
  "PASSWORD_PROTECTED_PDF",
  "TOO_MANY_PAGES",
  "UNSUPPORTED_SCANNED_PDF",
  "TABLE_NOT_FOUND",
  "NO_VERIFIABLE_TRANSACTIONS",
  "PARSE_FAILED",
  "UNKNOWN",
] as const;
type ApiErrorCode = (typeof apiErrorCodes)[number];

function getApiErrorKey(code: string): ApiErrorCode {
  return apiErrorCodes.includes(code as ApiErrorCode) ? (code as ApiErrorCode) : "UNKNOWN";
}

async function errorResponse(
  code: string,
  status: number,
  locale: AppLocale,
  quota?: Partial<Pick<ErrorPayload, "period" | "usedPages" | "remainingPages" | "limitPages">>,
): Promise<NextResponse<ErrorPayload>> {
  const t = await getTranslations({ locale, namespace: "ApiErrors" });
  const message = t(getApiErrorKey(code));
  return NextResponse.json({ code, message, ...quota }, { status });
}

async function setAnonymousCookie(
  response: NextResponse | Promise<NextResponse>,
  value: string | null,
): Promise<NextResponse> {
  const resolvedResponse = await response;
  if (value) {
    resolvedResponse.cookies.set({
      name: ANONYMOUS_COOKIE,
      value,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return resolvedResponse;
}

function isCurrentUsageAtLimit(
  record: Awaited<ReturnType<typeof getUsageRecord>>,
  context: QuotaContext,
): boolean {
  return Boolean(record && isUsageRecordCurrent(record, context) && record.used_pages >= context.limitPages);
}

function getClientAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || null;
}

async function getRequestActor(request: Request): Promise<{ actor: UsageActor; cookieValue: string | null }> {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (user) {
    return {
      actor: { type: "user", key: user.id, email: user.email ?? null },
      cookieValue: null,
    };
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(ANONYMOUS_COOKIE)?.value;
  const cookieValue = existingCookie ?? createAnonymousId();
  const clientAddress = getClientAddress(request);
  const actorKey = clientAddress
    ? hashAnonymousId(`network:${clientAddress}`)
    : hashAnonymousId(`cookie:${cookieValue}`);
  return {
    actor: { type: "anonymous", key: actorKey, email: null },
    cookieValue: existingCookie ? null : cookieValue,
  };
}

async function readErrorPayload(response: Response): Promise<Pick<ErrorPayload, "code">> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "code" in payload &&
      typeof payload.code === "string"
    ) {
      return { code: payload.code };
    }
  } catch {
    // The parser may return a non-JSON error when it is unavailable.
  }

  return { code: "INVALID_PARSER_RESPONSE" };
}

export async function POST(request: Request): Promise<Response> {
  const locale = getRequestLocale(request);
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("INVALID_REQUEST", 400, locale);
  }

  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return errorResponse("MISSING_FILE", 400, locale);
  }

  if (!entry.name.toLowerCase().endsWith(".pdf")) {
    return errorResponse("INVALID_FILE_TYPE", 400, locale);
  }
  if (entry.size === 0) {
    return errorResponse("EMPTY_FILE", 400, locale);
  }
  if (entry.size > MAX_UPLOAD_BYTES) {
    return errorResponse("FILE_TOO_LARGE", 413, locale);
  }

  let actor: UsageActor;
  let anonymousCookie: string | null;
  let context: QuotaContext;
  try {
    const requestActor = await getRequestActor(request);
    actor = requestActor.actor;
    anonymousCookie = requestActor.cookieValue;
    const subscription = actor.type === "user" ? await getEntitledSubscription(actor.key) : null;
    context = getQuotaContext(actor, subscription);
    const currentUsage = await getUsageRecord(actor);
    if (isCurrentUsageAtLimit(currentUsage, context)) {
      return setAnonymousCookie(
        errorResponse("QUOTA_EXHAUSTED", 429, locale, {
          period: context.window.period,
          usedPages: currentUsage?.used_pages,
          remainingPages: 0,
          limitPages: context.limitPages,
        }),
        anonymousCookie,
      );
    }
  } catch (error) {
    if (!(error instanceof UsageUnavailableError) && !(error instanceof SubscriptionPeriodUnavailableError)) {
      console.error("Failed to resolve conversion quota", error);
    }
    const code = error instanceof SubscriptionPeriodUnavailableError
      ? "QUOTA_PERIOD_UNAVAILABLE"
      : "QUOTA_UNAVAILABLE";
    return errorResponse(code, 503, locale);
  }

  const upstreamData = new FormData();
  upstreamData.append(
    "file",
    new Blob([await entry.arrayBuffer()], { type: entry.type || "application/pdf" }),
    entry.name,
  );

  const parserBaseUrl = (process.env.PARSER_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const parserSecret = process.env.PARSER_SHARED_SECRET?.trim();
  if (!parserSecret) {
    return setAnonymousCookie(
      errorResponse("PARSER_NOT_CONFIGURED", 503, locale),
      anonymousCookie,
    );
  }

  const parserUrl = `${parserBaseUrl}/parse`;
  let parserResponse: Response;
  try {
    parserResponse = await fetch(parserUrl, {
      method: "POST",
      body: upstreamData,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${parserSecret}`,
      },
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    const code = error instanceof Error && error.name === "TimeoutError"
      ? "PARSER_TIMEOUT"
      : "PARSER_UNAVAILABLE";
    return setAnonymousCookie(
      errorResponse(code, 502, locale),
      anonymousCookie,
    );
  }

  if (!parserResponse.ok) {
    const payload = await readErrorPayload(parserResponse);
    return setAnonymousCookie(
      errorResponse(payload.code, parserResponse.status, locale),
      anonymousCookie,
    );
  }

  let payload: unknown;
  try {
    const responseBytes = await parserResponse.arrayBuffer();
    if (responseBytes.byteLength > MAX_RESPONSE_BYTES) {
      return setAnonymousCookie(
        errorResponse("PARSER_RESPONSE_TOO_LARGE", 502, locale),
        anonymousCookie,
      );
    }
    try {
      payload = JSON.parse(new TextDecoder().decode(responseBytes));
    } catch {
      return setAnonymousCookie(
        errorResponse("INVALID_PARSER_RESPONSE", 502, locale),
        anonymousCookie,
      );
    }
  } catch (error) {
    const code = error instanceof Error && error.name === "TimeoutError"
      ? "PARSER_TIMEOUT"
      : "PARSER_RESPONSE_UNREADABLE";
    return setAnonymousCookie(errorResponse(code, 502, locale), anonymousCookie);
  }

  if (!isParseResponse(payload) || !Number.isInteger(payload.pageCount) || payload.pageCount <= 0) {
    return setAnonymousCookie(
      errorResponse("INVALID_PARSER_RESPONSE", 502, locale),
      anonymousCookie,
    );
  }
  if (
    payload.summary.status === "failed" ||
    payload.summary.validRowCount + payload.summary.warningRowCount === 0
  ) {
    return setAnonymousCookie(
      errorResponse("NO_VERIFIABLE_TRANSACTIONS", 422, locale),
      anonymousCookie,
    );
  }

  let quotaResult;
  try {
    quotaResult = await consumeConversionQuota(context, payload.pageCount);
  } catch (error) {
    console.error("Failed to record conversion usage", error);
    return setAnonymousCookie(
      errorResponse("QUOTA_RECORD_FAILED", 503, locale),
      anonymousCookie,
    );
  }

  if (!quotaResult.allowed) {
    const code = quotaResult.remainingPages === 0 ? "QUOTA_EXHAUSTED" : "QUOTA_EXCEEDED";
    return setAnonymousCookie(
      errorResponse(code, 429, locale, {
        period: quotaResult.period,
        usedPages: quotaResult.usedPages,
        remainingPages: quotaResult.remainingPages,
        limitPages: quotaResult.limitPages,
      }),
      anonymousCookie,
    );
  }

  return setAnonymousCookie(NextResponse.json(payload, { status: 200 }), anonymousCookie);
}
