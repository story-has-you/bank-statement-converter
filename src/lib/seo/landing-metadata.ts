import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { findBankPage, type ConversionPageId } from "@/config/conversion-pages";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { getLandingContent } from "@/lib/seo/landing-content";

export async function getLandingMetadata(locale: string, id: ConversionPageId): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) notFound();
  const c = await getLandingContent(locale, id);
  const title = `${c.label} | ${c.geo.brand}`;
  const alternates = getLocalizedAlternates(c.page.path, locale);
  return {
    title,
    description: c.intro,
    alternates,
    openGraph: { type: "website", siteName: c.geo.brand, title, description: c.intro, url: alternates.canonical, locale: locale.replace("-", "_") },
    twitter: { card: "summary_large_image", title, description: c.intro },
    robots: { index: true, follow: true },
  };
}

export async function getBankLandingMetadata(params: Promise<{ locale: string; slug: string }>): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = findBankPage(slug);
  if (!page) notFound();
  return getLandingMetadata(locale, page.id);
}
