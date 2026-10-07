import { NextResponse } from "next/server";

import { isMembershipTier, getPayPalPlanId, getPayPalServerConfig } from "@/lib/paypal/config";
import { createPayPalSubscription } from "@/lib/paypal/server";
import { upsertBillingSubscription, findOpenBillingSubscription } from "@/lib/billing/server";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations(request);
  const supabase = await createClient();
  if (!supabase) return errorResponse(t("loginUnavailable"), 503);

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return errorResponse(t("loginRequired"), 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(t("invalidRequest"), 400);
  }

  const tier =
    typeof payload === "object" && payload !== null && "tier" in payload
      ? payload.tier
      : null;
  if (!isMembershipTier(tier)) return errorResponse(t("invalidTier"), 400);

  const planId = getPayPalPlanId(tier);
  if (!getPayPalServerConfig() || !planId) {
    return errorResponse(t("configurationMissing"), 503);
  }

  try {
    const existing = await findOpenBillingSubscription(data.user.id);
    if (existing) return errorResponse(t("existingSubscription"), 409);

    const subscription = await createPayPalSubscription(planId, data.user.id);
    if (!subscription.id) return errorResponse(t("createFailed"), 502);

    await upsertBillingSubscription({
      user_id: data.user.id,
      email: data.user.email ?? "",
      tier,
      paypal_subscription_id: subscription.id,
      paypal_plan_id: planId,
      status: subscription.status === "APPROVED" || subscription.status === "ACTIVE"
        ? subscription.status
        : "APPROVAL_PENDING",
      payer_id: subscription.subscriber?.payerId ?? null,
      subscriber_email: subscription.subscriber?.emailAddress ?? null,
      current_period_start: subscription.startTime ?? null,
      current_period_end: subscription.billingInfo?.nextBillingTime ?? null,
      last_webhook_event_id: null,
      last_event_at: null,
    });
    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (error) {
    console.error("Failed to create PayPal subscription", error);
    return errorResponse(t("createFailed"), 502);
  }
}
