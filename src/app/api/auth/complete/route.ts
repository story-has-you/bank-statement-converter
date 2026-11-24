import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { funnelAnalyticsEnabled, loginPendingCookie, trialPendingCookie } from "@/config/analytics";
import { resolveLocale } from "@/i18n/locale";
import { getLocalizedPath } from "@/i18n/metadata";
import { getSession } from "@/lib/auth/server";
import { syncBillingSubscriptionStatus } from "@/lib/billing/subscriptions";
import { getDatabase } from "@/lib/db/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("locale"));
  const { userId, sessionId } = await getSession();
  const destination = getLocalizedPath(locale, userId && sessionId ? "/" : "/auth/error");
  const response = NextResponse.redirect(new URL(destination, url.origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  if (!userId || !sessionId) {
    return response;
  }

  try {
    const client = await clerkClient();
    const session = await client.sessions.getSession(sessionId);
    const db = getDatabase();
    const now = new Date();
    const [, claim] = await db.batch([
      db.prepare("DELETE FROM auth_session_notifications WHERE expires_at <= ?").bind(now.toISOString()),
      db
        .prepare("INSERT INTO auth_session_notifications (session_id, expires_at) VALUES (?, ?) ON CONFLICT DO NOTHING")
        .bind(sessionId, new Date(session.expireAt).toISOString()),
    ]);
    if (!claim.meta.changes) {
      return response;
    }

    if (funnelAnalyticsEnabled) {
      try {
        const user = await client.users.getUser(userId);
        const ageAtSignIn = session.createdAt - user.createdAt;
        const notification = ageAtSignIn >= 0 && ageAtSignIn <= 60_000 ? "sign_up" : "login";
        const options = { maxAge: 300, path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
        response.cookies.set(loginPendingCookie, notification, options);
        response.cookies.set(trialPendingCookie, "true", options);
      } catch {
        console.warn("AUTH_LOGIN_ANALYTICS_FAILED");
      }
    }
    await syncBillingSubscriptionStatus(userId);
  } catch {
    console.warn("AUTH_SESSION_COMPLETION_FAILED");
  }
  return response;
}
