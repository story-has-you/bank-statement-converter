import { NextResponse } from "next/server";

import { findOpenBillingSubscription } from "@/lib/billing/server";
import { isMembershipTier, getPayPalPlanId, getPayPalServerConfig } from "@/lib/paypal/config";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { createPayPalSubscription } from "@/lib/paypal/server";
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
  if (!data.user.email) return errorResponse(t("emailMissing"), 422);

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
    if (await findOpenBillingSubscription(data.user.id)) {
      return errorResponse(t("existingSubscription"), 409);
    }

    const subscription = await createPayPalSubscription(planId, data.user.id);
    if (!subscription.id) throw new Error("PayPal did not return a subscription ID");
    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (error) {
    console.error("Failed to create PayPal subscription", error);
    return errorResponse(t("createFailed"), 502);
  }
}
