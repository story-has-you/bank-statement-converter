import type { MetadataRoute } from "next";

import { getLocalizedAlternates, getLocalizedPath } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { publicPaths, publicContentPages } from "@/config/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.flatMap((pathname) =>
    routing.locales.map((locale) => ({
      url: `${siteConfig.url}${getLocalizedPath(locale, pathname)}`,
      lastModified: publicContentPages.find((page) => page.path === pathname)?.checkedOn,
      alternates: { languages: getLocalizedAlternates(pathname).languages },
    })),
  );
}
