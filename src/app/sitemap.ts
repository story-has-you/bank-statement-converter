import type { MetadataRoute } from "next";

import { getLocalizedAlternates, getLocalizedPath } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { agentDocuments, getAgentDocumentUrl } from "@/lib/geo/links";

const publicPaths = ["/", "/terms", "/privacy"] as const;

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
