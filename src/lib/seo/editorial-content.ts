import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { findEditorialPage } from "@/config/editorial-pages";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";

export type EditorialParams = Promise<{ locale: string; content: string[] }>;
export type EditorialSection = { title: string; text: string };

export async function getEditorialContent(params: EditorialParams) {
  const { locale, content } = await params;
  const page = findEditorialPage(`/${content.join("/")}`);
  if (!hasLocale(routing.locales, locale) || !page) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: `Editorial.pages.${page.id}` });
  return {
    page,
    locale,
    title: t("title"),
    intro: t("intro"),
    sections: t.raw("sections") as EditorialSection[],
    faq: t.raw("faq") as { question: string; answer: string }[],
  };
}

export async function getEditorialMetadata(params: EditorialParams): Promise<Metadata> {
  const c = await getEditorialContent(params);
  const title = `${c.title} | StatementXL`;
  return {
    title,
    description: c.intro,
    alternates: getLocalizedAlternates(c.page.path, c.locale),
    openGraph: {
      title,
      description: c.intro,
      type: "website",
      siteName: "StatementXL",
      url: getLocalizedAlternates(c.page.path, c.locale).canonical,
    },
    twitter: { card: "summary_large_image", title, description: c.intro },
  };
}

export type EditorialContent = Awaited<ReturnType<typeof getEditorialContent>>;
