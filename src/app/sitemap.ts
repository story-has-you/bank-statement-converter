import type { MetadataRoute } from "next";

import { getLocalizedAlternates, getLocalizedPath } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { conversionPages } from "@/config/conversion-pages";
import { agentDocuments, getAgentDocumentUrl } from "@/lib/geo/links";

const publicPaths = ["/", "/terms", "/privacy", ...conversionPages.map((page) => page.path)];

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = publicPaths.flatMap((pathname) =>
    routing.locales.map((locale) => ({ url: `${siteConfig.url}${getLocalizedPath(locale, pathname)}`, alternates: { languages: getLocalizedAlternates(pathname).languages } })),
  );
  const documents = agentDocuments.flatMap((document) => {
    const languages = Object.fromEntries(routing.locales.map((locale) => [locale, getAgentDocumentUrl(locale, document)]));
    return routing.locales.map((locale) => ({
      url: getAgentDocumentUrl(locale, document),
      alternates: { languages: { ...languages, "x-default": getAgentDocumentUrl(routing.defaultLocale, document) } },
    }));
  });
  return [...pages, ...documents];
}
