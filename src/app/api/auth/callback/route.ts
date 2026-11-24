import { NextResponse } from "next/server";

import { funnelAnalyticsEnabled, loginPendingCookie, trialPendingCookie } from "@/config/analytics";
import { getLocalizedPath } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { syncBillingSubscriptionStatus } from "@/lib/billing/subscriptions";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedLocale = searchParams.get("locale");
  const locale = routing.locales.find((supportedLocale) => supportedLocale === requestedLocale) ?? routing.defaultLocale;
  const redirectPath = getLocalizedPath(locale, "/");

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const response = NextResponse.redirect(new URL(redirectPath, origin));
        try {
          const { data, error: userError } = await supabase.auth.getUser();
          if (userError || !data.user) {
            console.error("Failed to verify login user for subscription synchronization");
          } else {
            if (funnelAnalyticsEnabled) {
              const createdAt = Date.parse(data.user.created_at);
              const lastSignInAt = Date.parse(data.user.last_sign_in_at ?? "");
              const signInDelay = lastSignInAt - createdAt;
              const notification = signInDelay >= 0 && signInDelay <= 60_000 ? "sign_up" : "login";
              const options = {
                maxAge: 300,
                path: "/",
                sameSite: "lax" as const,
                secure: process.env.NODE_ENV === "production",
              };
              response.cookies.set(loginPendingCookie, notification, options);
              response.cookies.set(trialPendingCookie, "true", options);
            }
            await syncBillingSubscriptionStatus(data.user.id);
          }
        } catch {
          console.error("Failed to verify login user for subscription synchronization");
        }

        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    }
  }

  const response = NextResponse.redirect(new URL(getLocalizedPath(locale, "/auth/error"), origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
