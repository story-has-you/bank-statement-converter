import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { maxUploadBytes } from "@/config/conversion";
import { createConversionResponse, errorResponse } from "@/lib/conversion/response";
import { canUseQwen } from "@/lib/conversion/parser";
import {
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ANONYMOUS_COOKIE = "bank-statement-converter-anonymous";
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

  if (
    !entry.name.toLowerCase().endsWith(".pdf") ||
    (entry.type && entry.type !== "application/pdf" && entry.type !== "application/octet-stream")
  ) {
    return errorResponse("INVALID_FILE_TYPE", 400, locale);
  }
  if (entry.size === 0) {
    return errorResponse("EMPTY_FILE", 400, locale);
  }
  if (entry.size > maxUploadBytes) {
    return errorResponse("FILE_TOO_LARGE", 413, locale);
  }

  const header = new Uint8Array(await entry.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== "%PDF-") {
    return errorResponse("INVALID_PDF", 400, locale);
  }

  let actor: UsageActor;
  let anonymousCookie: string | null;
  let context: QuotaContext;
  let allowQwen = false;
  let availablePages: number;
  try {
    const requestActor = await getRequestActor(request);
    actor = requestActor.actor;
    anonymousCookie = requestActor.cookieValue;
    const subscription = actor.type === "user" ? await getEntitledSubscription(actor.key) : null;
    context = getQuotaContext(actor, subscription);
    allowQwen = canUseQwen(subscription?.tier);
    const currentUsage = await getUsageRecord(actor);
    const usedPages = currentUsage && isUsageRecordCurrent(currentUsage, context) ? currentUsage.used_pages : 0;
    availablePages = Math.max(0, context.limitPages - usedPages);
    if (availablePages === 0) {
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
  const response = await createConversionResponse(request, entry, context, allowQwen, locale, availablePages);
  return setAnonymousCookie(response, anonymousCookie);
}
