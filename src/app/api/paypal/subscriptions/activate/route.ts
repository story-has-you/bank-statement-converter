import { NextResponse } from "next/server";

import { upsertBillingSubscription, findBillingSubscriptionByPayPalId } from "@/lib/billing/server";
import { isMembershipTier, getPayPalPlanId, getPayPalServerConfig } from "@/lib/paypal/config";
import { getPayPalSubscription } from "@/lib/paypal/server";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivateRequest = {
  subscriptionId: string;
  tier: string;
};

function isActivateRequest(value: unknown): value is ActivateRequest {
  if (typeof value !== "object" || value === null) return false;
  if (!("subscriptionId" in value) || !("tier" in value)) return false;

  return (
    typeof value.subscriptionId === "string" &&
    value.subscriptionId.length > 0 &&
    value.subscriptionId.length <= 64 &&
    typeof value.tier === "string"
  );
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations();
  const supabase = await createClient();
  if (!supabase) {
    return errorResponse(t("loginUnavailable"), 503);
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return errorResponse(t("loginRequired"), 401);
  }

  if (!data.user.email) {
    return errorResponse(t("emailMissing"), 422);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(t("invalidRequest"), 400);
  }

  if (!isActivateRequest(payload) || !isMembershipTier(payload.tier)) {
    return errorResponse(t("invalidTier"), 400);
  }

  const serverConfig = getPayPalServerConfig();
  const expectedPlanId = getPayPalPlanId(payload.tier);
  if (!serverConfig || !expectedPlanId) {
    return errorResponse(t("configurationMissing"), 503);
  }

  try {
    const existing = await findBillingSubscriptionByPayPalId(payload.subscriptionId);
    if (existing && existing.user_id !== data.user.id) {
      return errorResponse(t("subscriptionBelongsToAnotherAccount"), 409);
    }

    const subscription = await getPayPalSubscription(payload.subscriptionId);
    const status = subscription.status;

    if (
      subscription.id !== payload.subscriptionId ||
      subscription.planId !== expectedPlanId ||
      (subscription.customId !== undefined && subscription.customId !== data.user.id) ||
      (status !== "APPROVED" && status !== "ACTIVE")
    ) {
      return errorResponse(t("verificationFailed"), 400);
    }

    const billingSubscription = await upsertBillingSubscription({
      user_id: data.user.id,
      email: data.user.email,
      tier: payload.tier,
      paypal_subscription_id: payload.subscriptionId,
      paypal_plan_id: expectedPlanId,
      status,
      payer_id: subscription.subscriber?.payerId ?? null,
      subscriber_email: subscription.subscriber?.emailAddress ?? null,
      current_period_start: subscription.startTime ?? null,
      current_period_end: subscription.billingInfo?.nextBillingTime ?? null,
      last_webhook_event_id: existing?.last_webhook_event_id ?? null,
      last_event_at: existing?.last_event_at ?? null,
    });

    return NextResponse.json({
      tier: billingSubscription.tier,
      status: billingSubscription.status,
      subscriptionId: billingSubscription.paypal_subscription_id,
    });
  } catch (error) {
    console.error("Failed to activate PayPal subscription", error);
    return errorResponse(t("activationFailed"), 502);
  }
}
