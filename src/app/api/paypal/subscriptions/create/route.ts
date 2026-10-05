import { NextResponse } from "next/server";

import { isMembershipTier, getPayPalPlanId, getPayPalServerConfig } from "@/lib/paypal/config";
import { createPayPalSubscription } from "@/lib/paypal/server";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations();
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
    const subscription = await createPayPalSubscription(planId, data.user.id);
    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (error) {
    console.error("Failed to create PayPal subscription", error);
    return errorResponse(t("createFailed"), 502);
  }
}
