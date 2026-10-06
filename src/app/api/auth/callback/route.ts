import { NextResponse } from "next/server";

import { getLocalizedPath } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
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
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    }
  }

  const response = NextResponse.redirect(new URL(`${redirectPath}/auth/error`, origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
