import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { getRequestLocale } from "@/i18n/locale";
import { getAccountSnapshot } from "@/lib/account/server";
import { syncBillingSubscriptionStatus } from "@/lib/billing/subscriptions";
import { getAccountUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const t = await getTranslations({ locale: getRequestLocale(request), namespace: "Billing.api" });
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getAccountUser();
    if (!user) {
      return NextResponse.json({ error: t("loginRequired") }, { status: 401, headers });
    }
    await syncBillingSubscriptionStatus(user.id);
    const snapshot = await getAccountSnapshot(user);
    return NextResponse.json(snapshot, { status: snapshot.subscriptions === null ? 503 : 200, headers });
  } catch {
    return NextResponse.json({ error: t("loginUnavailable") }, { status: 503, headers });
  }
}
