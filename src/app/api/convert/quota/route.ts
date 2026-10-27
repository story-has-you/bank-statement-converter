import { NextResponse } from "next/server";

import { getRequestLocale } from "@/i18n/locale";
import { errorResponse } from "@/lib/conversion/response";
import { getRequestQuota, setAnonymousCookie } from "@/lib/usage/request";
import { consumeConversionQuota, SubscriptionPeriodUnavailableError, UsageUnavailableError } from "@/lib/usage/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { quota, anonymousCookie } = await getRequestQuota(request);
    return setAnonymousCookie(NextResponse.json(quota, { headers }), anonymousCookie);
  } catch (error) {
    if (!(error instanceof UsageUnavailableError) && !(error instanceof SubscriptionPeriodUnavailableError)) {
      console.error("Failed to resolve conversion quota", { code: "QUOTA_UNAVAILABLE" });
    }
    const code = error instanceof SubscriptionPeriodUnavailableError ? "QUOTA_PERIOD_UNAVAILABLE" : "QUOTA_UNAVAILABLE";
    const response = await errorResponse(code, 503, getRequestLocale(request));
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    return response;
  }
}

export async function POST(request: Request): Promise<Response> {
  const locale = getRequestLocale(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", 400, locale);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("pageCount" in body) ||
    typeof body.pageCount !== "number" ||
    !Number.isSafeInteger(body.pageCount) ||
    body.pageCount <= 0
  ) {
    return errorResponse("INVALID_REQUEST", 400, locale);
  }
  let resolved: Awaited<ReturnType<typeof getRequestQuota>>;
  try {
    resolved = await getRequestQuota(request);
  } catch (error) {
    return errorResponse(
      error instanceof SubscriptionPeriodUnavailableError ? "QUOTA_PERIOD_UNAVAILABLE" : "QUOTA_UNAVAILABLE",
      503,
      locale,
    );
  }
  try {
    const result = await consumeConversionQuota(resolved.context, body.pageCount);
    if (!result.allowed) {
      let code = result.remainingPages === 0 ? "QUOTA_EXHAUSTED" : "QUOTA_EXCEEDED";
      if (result.status === "stale") {
        code = "QUOTA_PERIOD_UNAVAILABLE";
      }
      return setAnonymousCookie(errorResponse(code, result.status === "stale" ? 503 : 429, locale, result), resolved.anonymousCookie);
    }
    return setAnonymousCookie(NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } }), resolved.anonymousCookie);
  } catch {
    return setAnonymousCookie(errorResponse("QUOTA_RECORD_FAILED", 503, locale), resolved.anonymousCookie);
  }
}
