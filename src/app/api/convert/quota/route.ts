import { NextResponse } from "next/server";

import { getRequestLocale } from "@/i18n/locale";
import { errorResponse } from "@/lib/conversion/response";
import { getRequestQuota, setAnonymousCookie } from "@/lib/usage/request";
import { SubscriptionPeriodUnavailableError, UsageUnavailableError } from "@/lib/usage/server";

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
