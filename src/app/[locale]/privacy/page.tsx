import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LegalPageLayout } from "@/components/legal-page-layout";
import { PrivacyContent } from "@/components/privacy-content";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Privacy.metadata" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getLocalizedAlternates("/privacy", locale),
  };
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout>
      <PrivacyContent />
    </LegalPageLayout>
  );
}
