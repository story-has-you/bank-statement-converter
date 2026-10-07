import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isParseResponse } from "@/lib/conversion-types";
import {
  consumeConversionQuota,
  createAnonymousId,
  getActiveSubscription,
  getQuotaContext,
  getUsageRecord,
  hashAnonymousId,
  isUsageRecordCurrent,
  type UsageActor,
  type QuotaContext,
  UsageUnavailableError,
} from "@/lib/usage/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestLocale } from "@/i18n/locale";
import type { AppLocale } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  "PARSER_UNAVAILABLE",
  "QUOTA_EXCEEDED",
  "QUOTA_UNAVAILABLE",
  "FILE_TOO_LARGE",
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

async function getRequestActor(): Promise<{ actor: UsageActor; cookieValue: string | null }> {
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
  return {
    actor: { type: "anonymous", key: hashAnonymousId(cookieValue), email: null },
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

  return { code: "PARSER_UNAVAILABLE" };
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
    return errorResponse("INVALID_FILE", 400, locale);
  }

  if (!entry.name.toLowerCase().endsWith(".pdf") || entry.size === 0) {
    return errorResponse("INVALID_FILE", 400, locale);
  }

  let actor: UsageActor;
  let anonymousCookie: string | null;
  let context: QuotaContext;
  try {
    const requestActor = await getRequestActor();
    actor = requestActor.actor;
    anonymousCookie = requestActor.cookieValue;
    const subscription = actor.type === "user" ? await getActiveSubscription(actor.key) : null;
    context = getQuotaContext(actor, subscription);
    const currentUsage = await getUsageRecord(actor);
    if (isCurrentUsageAtLimit(currentUsage, context)) {
      return setAnonymousCookie(
        errorResponse("QUOTA_EXCEEDED", 429, locale, {
          period: context.window.period,
          usedPages: currentUsage?.used_pages,
          remainingPages: 0,
          limitPages: context.limitPages,
        }),
        anonymousCookie,
      );
    }
  } catch (error) {
    if (!(error instanceof UsageUnavailableError)) {
      console.error("Failed to resolve conversion quota", error);
    }
    return errorResponse("QUOTA_UNAVAILABLE", 503, locale);
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
      errorResponse("PARSER_UNAVAILABLE", 503, locale),
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
  } catch {
    return setAnonymousCookie(
      errorResponse("PARSER_UNAVAILABLE", 502, locale),
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

  try {
    const payload: unknown = await parserResponse.json();
    if (!isParseResponse(payload) || !Number.isInteger(payload.pageCount) || payload.pageCount <= 0) {
      return setAnonymousCookie(
        errorResponse("PARSER_UNAVAILABLE", 502, locale),
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
        errorResponse("QUOTA_UNAVAILABLE", 503, locale),
        anonymousCookie,
      );
    }

    if (!quotaResult.allowed) {
      return setAnonymousCookie(
        errorResponse("QUOTA_EXCEEDED", 429, locale, {
          period: quotaResult.period,
          usedPages: quotaResult.usedPages,
          remainingPages: quotaResult.remainingPages,
          limitPages: quotaResult.limitPages,
        }),
        anonymousCookie,
      );
    }

    return setAnonymousCookie(NextResponse.json(payload, { status: 200 }), anonymousCookie);
  } catch {
    return setAnonymousCookie(
      errorResponse("PARSER_UNAVAILABLE", 502, locale),
      anonymousCookie,
    );
  }
}
