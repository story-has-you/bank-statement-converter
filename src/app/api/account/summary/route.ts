import { NextResponse } from "next/server";

import { anonymousAccountSummary, type PublicAccountSummary } from "@/lib/account/summary";
import { getCheckoutConfigs } from "@/lib/billing/providers";
import { findEntitledBillingSubscription, findOpenBillingSubscription } from "@/lib/billing/server";
import { getAccountUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Read-only display state. Checkout and conversion keep their own authorization. */
export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getAccountUser();
    if (!user) {
      return NextResponse.json(anonymousAccountSummary, { headers });
    }
    const [active, open] = await Promise.all([findEntitledBillingSubscription(user.id), findOpenBillingSubscription(user.id)]);
    const summary: PublicAccountSummary = {
      user: { email: user.email ?? null, avatarUrl: user.avatarUrl },
      activeTier: active?.tier ?? null,
      hasSubscription: Boolean(active || open),
      cancelledPeriodEnd: active?.status === "CANCELLED" ? active.current_period_end : null,
      checkouts: getCheckoutConfigs(),
    };
    return NextResponse.json(summary, { headers });
  } catch {
    return NextResponse.json({ code: "ACCOUNT_SUMMARY_UNAVAILABLE" }, { status: 503, headers });
  }
}
