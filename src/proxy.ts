import { clerkMiddleware } from "@clerk/nextjs/server";

import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { publicPaths } from "./config/public-pages";
import { getAgentDocumentUrl } from "./lib/geo/links";

const handleLocale = createMiddleware(routing);

function withAgentLinks(response: NextResponse, request: NextRequest): NextResponse {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];
  const locale = hasLocale(routing.locales, firstSegment) ? firstSegment : routing.defaultLocale;
  if (locale === firstSegment) {
    segments.shift();
  }
  const path = segments.join("/");
  if (!publicPaths.includes(`/${path}`)) {
    return response;
  }
  const links = [`<${getAgentDocumentUrl(locale, "llms.txt")}>; rel="describedby"`];
  if (["", "privacy"].includes(path)) {
    links.push(`<${getAgentDocumentUrl(locale, path === "privacy" ? "privacy.md" : "index.md")}>; rel="alternate"; type="text/markdown"`);
  }
  response.headers.append("Link", links.join(", "));
  return response;
}

export default clerkMiddleware(async (_auth, request) => {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  return withAgentLinks(handleLocale(request), request);
});

export const config = {
  matcher: [
    "/((?!api|ai/|ai$|trpc|_next|_vercel|.*\\..*).*)",
    "/api/((?!billing/webhooks/|auth/webhook$).*)",
  ],
};
