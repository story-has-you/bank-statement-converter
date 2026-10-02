import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { getSupabaseConfig } from "./lib/supabase/config";

const handleLocale = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return handleLocale(request);

  let authResponse = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        authResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => authResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => authResponse.headers.set(name, value));
      },
    },
  });

  await supabase.auth.getClaims();

  const response = handleLocale(request);
  authResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = authResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
