import { NextResponse } from "next/server";

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
        try {
          const { data, error: userError } = await supabase.auth.getUser();
          if (userError || !data.user) {
            console.error("Failed to verify login user for subscription synchronization");
          } else {
            await syncBillingSubscriptionStatus(data.user.id);
          }
        } catch {
          console.error("Failed to verify login user for subscription synchronization");
        }

        const response = NextResponse.redirect(new URL(redirectPath, origin));
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    }
  }

  const response = NextResponse.redirect(new URL(`${redirectPath}/auth/error`, origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
