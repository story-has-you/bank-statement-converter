import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { resolveLocale } from "@/i18n/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: "Account.metadata" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}
