import { routing, type AppLocale } from "./routing";

export function resolveLocale(value: string | null | undefined): AppLocale {
  return routing.locales.find((locale) => locale === value) ?? routing.defaultLocale;
}

export function getRequestLocale(request: Request): AppLocale {
  return resolveLocale(request.headers.get("x-app-locale"));
}
