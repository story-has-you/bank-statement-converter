import { NextResponse } from "next/server";

import { findBillingSubscriptionByPayPalId } from "@/lib/billing/server";
import { isMembershipTier, getPayPalPlanId } from "@/lib/paypal/config";
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
  const t = await getPayPalApiTranslations(request);
  const supabase = await createClient();
  if (!supabase) {
    return errorResponse(t("loginUnavailable"), 503);
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return errorResponse(t("loginRequired"), 401);
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

  const expectedPlanId = getPayPalPlanId(payload.tier);
  if (!expectedPlanId) {
    return errorResponse(t("configurationMissing"), 503);
  }

  try {
    const existing = await findBillingSubscriptionByPayPalId(payload.subscriptionId);
    if (existing && existing.user_id !== data.user.id) {
      return errorResponse(t("subscriptionBelongsToAnotherAccount"), 409);
    }

    if (!existing) {
      return NextResponse.json({ status: "PENDING" }, { status: 202 });
    }

    if (existing.paypal_plan_id !== expectedPlanId || existing.tier !== payload.tier) {
      return errorResponse(t("verificationFailed"), 400);
    }

    if (existing.status !== "ACTIVE") {
      if (existing.status === "PAYMENT_FAILED" || existing.status === "CANCELLED" || existing.status === "EXPIRED") {
        return errorResponse(t("verificationFailed"), 409);
      }
      return NextResponse.json({ status: "PENDING" }, { status: 202 });
    }

    const periodStart = existing.current_period_start ? Date.parse(existing.current_period_start) : NaN;
    const periodEnd = existing.current_period_end ? Date.parse(existing.current_period_end) : NaN;
    if (
      !Number.isFinite(periodStart) ||
      !Number.isFinite(periodEnd) ||
      periodStart >= periodEnd ||
      periodEnd <= Date.now()
    ) {
      return errorResponse(t("verificationFailed"), 409);
    }

    return NextResponse.json({
      tier: existing.tier,
      status: existing.status,
      subscriptionId: existing.paypal_subscription_id,
    });
  } catch (error) {
    console.error("Failed to activate PayPal subscription", error);
    return errorResponse(t("activationFailed"), 502);
  }
}
