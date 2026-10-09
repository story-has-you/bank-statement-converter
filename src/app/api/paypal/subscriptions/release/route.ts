import { NextResponse } from "next/server";

import { releaseBillingSubscriptionIntentForSubscription } from "@/lib/billing/server";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations(request);
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: t("loginUnavailable") }, { status: 503 });

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return NextResponse.json({ error: t("loginRequired") }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalidRequest") }, { status: 400 });
  }

  const subscriptionId =
    typeof payload === "object" && payload !== null && "subscriptionId" in payload
      ? payload.subscriptionId
      : null;
  if (typeof subscriptionId !== "string" || !subscriptionId || subscriptionId.length > 64) {
    return NextResponse.json({ error: t("invalidRequest") }, { status: 400 });
  }

  try {
    await releaseBillingSubscriptionIntentForSubscription(data.user.id, subscriptionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to release PayPal subscription intent", error);
    return NextResponse.json({ error: t("intentReleaseFailed") }, { status: 502 });
  }
}
