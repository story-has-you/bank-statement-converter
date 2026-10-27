import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";

export async function getResourcesMetadata(locale: string): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "Resources" });
  const title = `${t("title")} | StatementXL`;
  const description = t("metaDescription");
  const alternates = getLocalizedAlternates("/resources", locale);
  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "StatementXL",
      url: alternates.canonical,
      locale: locale.replace("-", "_"),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
