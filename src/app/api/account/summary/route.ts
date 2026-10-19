import { NextResponse } from "next/server";

import { getUserAvatarUrl } from "@/lib/account/avatar";
import { anonymousAccountSummary, type PublicAccountSummary } from "@/lib/account/summary";
import { findEntitledBillingSubscription, findOpenBillingSubscription } from "@/lib/billing/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Read-only display state. Checkout and conversion keep their own authorization. */
export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    if (!client) {
      return NextResponse.json(anonymousAccountSummary, { headers });
    }
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") {
      throw error;
    }
    if (!data.user) {
      return NextResponse.json(anonymousAccountSummary, { headers });
    }
    const [active, open] = await Promise.all([findEntitledBillingSubscription(data.user.id), findOpenBillingSubscription(data.user.id)]);
    const summary: PublicAccountSummary = {
      user: { email: data.user.email ?? null, avatarUrl: getUserAvatarUrl(data.user.user_metadata) },
      activeTier: active?.tier ?? null,
      hasSubscription: Boolean(active || open),
      cancelledPeriodEnd: active?.status === "CANCELLED" ? active.current_period_end : null,
    };
    return NextResponse.json(summary, { headers });
  } catch {
    return NextResponse.json({ code: "ACCOUNT_SUMMARY_UNAVAILABLE" }, { status: 503, headers });
  }
}
