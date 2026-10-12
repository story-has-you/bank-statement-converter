import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { getSupabaseConfig } from "./lib/supabase/config";
import { getAgentDocumentUrl } from "./lib/geo/links";

const handleLocale = createMiddleware(routing);

function withAgentLinks(response: NextResponse, request: NextRequest): NextResponse {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];
  const locale = hasLocale(routing.locales, firstSegment) ? firstSegment : routing.defaultLocale;
  if (locale === firstSegment) segments.shift();
  const path = segments.join("/");
  if (!["", "privacy", "terms"].includes(path)) return response;
  const links = [`<${getAgentDocumentUrl(locale, "llms.txt")}>; rel="describedby"`];
  if (path !== "terms") {
    links.push(`<${getAgentDocumentUrl(locale, path === "privacy" ? "privacy.md" : "index.md")}>; rel="alternate"; type="text/markdown"`);
  }
  response.headers.append("Link", links.join(", "));
  return response;
}

export default async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return withAgentLinks(handleLocale(request), request);

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
  return withAgentLinks(response, request);
}

export const config = { matcher: "/((?!api|ai/|ai$|trpc|_next|_vercel|.*\\..*).*)" };
