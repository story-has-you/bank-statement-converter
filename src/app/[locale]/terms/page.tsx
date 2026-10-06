import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LegalPageLayout } from "@/components/legal-page-layout";
import { TermsContent } from "@/components/terms-content";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Terms.metadata" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getLocalizedAlternates("/terms", locale),
  };
}

export default function TermsPage() {
  return (
    <LegalPageLayout>
      <TermsContent />
    </LegalPageLayout>
  );
}
