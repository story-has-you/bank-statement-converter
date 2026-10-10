import { NextResponse } from "next/server";

import { findBillingSubscriptionByPayPalId } from "@/lib/billing/server";
import { getPayPalServerConfig } from "@/lib/paypal/config";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { cancelPayPalSubscription, getPayPalSubscription } from "@/lib/paypal/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations(request);
  const errorResponse = (key: Parameters<typeof t>[0], status: number) =>
    NextResponse.json({ error: t(key) }, { status, headers: { "Cache-Control": "no-store" } });

  // Cookie 认证的取消操作仅接受当前站点发起的请求。
  if (request.headers.get("origin") !== new URL(request.url).origin) return errorResponse("cancelInvalidOrigin", 403);
  const supabase = await createClient();
  if (!supabase) return errorResponse("loginUnavailable", 503);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return errorResponse("loginRequired", 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("invalidRequest", 400);
  }
  if (
    typeof payload !== "object" || payload === null || !("subscriptionId" in payload) ||
    typeof payload.subscriptionId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(payload.subscriptionId)
  ) return errorResponse("invalidRequest", 400);
  if (!getPayPalServerConfig()) return errorResponse("configurationMissing", 503);

  try {
    const existing = await findBillingSubscriptionByPayPalId(payload.subscriptionId);
    if (!existing || existing.user_id !== data.user.id) return errorResponse("cancelSubscriptionNotFound", 404);
    if (existing.status !== "ACTIVE" && existing.status !== "CANCELLED") return errorResponse("cancelNotActive", 409);

    const subscription = await getPayPalSubscription(existing.paypal_subscription_id);
    if (
      subscription.id !== existing.paypal_subscription_id || subscription.customId !== data.user.id ||
      subscription.planId !== existing.paypal_plan_id
    ) return errorResponse("verificationFailed", 409);

    if (subscription.status !== "CANCELLED") {
      if (existing.status !== "ACTIVE" || subscription.status !== "ACTIVE") return errorResponse("cancelNotActive", 409);
      await cancelPayPalSubscription(existing.paypal_subscription_id);
    }
    return NextResponse.json({
      status: existing.status === "CANCELLED" ? "CANCELLED" : "CANCELLATION_PENDING",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Failed to cancel PayPal subscription");
    return errorResponse("cancelFailed", 502);
  }
}
