import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { getRequestLocale } from "@/i18n/locale";
import { getAccountSnapshot } from "@/lib/account/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const t = await getTranslations({ locale: getRequestLocale(request), namespace: "PayPal.api" });
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: t("loginUnavailable") }, { status: 503, headers });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: t("loginRequired") }, { status: 401, headers });
  const snapshot = await getAccountSnapshot(data.user);
  return NextResponse.json(snapshot, { status: snapshot.subscriptions === null ? 503 : 200, headers });
}
