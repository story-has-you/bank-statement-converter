import { siteConfig } from "@/config/site";
import { routing, type AppLocale } from "@/i18n/routing";

export function getLocalizedPath(locale: AppLocale, pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const path = normalizedPath === "/" ? "" : normalizedPath;

  if (locale === routing.defaultLocale) return normalizedPath;
  return `/${locale}${path}`;
}

export function getLocalizedAlternates(pathname: string, locale: AppLocale = routing.defaultLocale) {
  const languages = Object.fromEntries(
    routing.locales.map((supportedLocale) => [
      supportedLocale,
      `${siteConfig.url}${getLocalizedPath(supportedLocale, pathname)}`,
    ]),
  );

  return {
    canonical: languages[locale],
    languages: {
      ...languages,
      "x-default": languages[routing.defaultLocale],
    },
  };
}
