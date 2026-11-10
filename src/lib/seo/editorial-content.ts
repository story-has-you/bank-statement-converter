import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { findEditorialPage } from "@/config/editorial-pages";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { brandConfig } from "@/config/brand";
import { conversionLimits } from "@/config/conversion";
import { freeQuotaConfig } from "@/config/plans";

export type EditorialParams = Promise<{ locale: string; content: string[] }>;
export type EditorialSection = {
  title: string;
  text: string;
  quickbooksLink?: string;
  links?: { href: string; label: string }[];
};

export async function getEditorialContent(params: EditorialParams) {
  const { locale, content } = await params;
  const page = findEditorialPage(`/${content.join("/")}`);
  if (!hasLocale(routing.locales, locale) || !page) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: `Editorial.pages.${page.id}` });
  const values = {
    ...conversionLimits,
    url: brandConfig.url,
    anonymousPages: freeQuotaConfig.anonymous.pages,
    authenticatedPages: freeQuotaConfig.authenticated.pages,
  };
  return {
    page,
    locale,
    title: t("title"),
    intro: t("intro"),
    metaDescription: t("metaDescription"),
    sections: (t.raw("sections") as EditorialSection[]).map((section, i) => ({
      ...section,
      text: t(`sections.${i}.text`, values),
    })),
    faq: (t.raw("faq") as { question: string; answer: string }[]).map((item, i) => ({
      ...item,
      answer: t(`faq.${i}.answer`, values),
    })),
  };
}

export async function getEditorialMetadata(params: EditorialParams): Promise<Metadata> {
  const c = await getEditorialContent(params);
  const title = `${c.title} | StatementXL`;
  return {
    title,
    description: c.metaDescription,
    alternates: getLocalizedAlternates(c.page.path, c.locale),
    openGraph: {
      title,
      description: c.metaDescription,
      type: "website",
      siteName: "StatementXL",
      url: getLocalizedAlternates(c.page.path, c.locale).canonical,
      images: [brandConfig.socialImage],
    },
    twitter: { card: "summary_large_image", title, description: c.metaDescription, images: [brandConfig.socialImage] },
  };
}

export type EditorialContent = Awaited<ReturnType<typeof getEditorialContent>>;
