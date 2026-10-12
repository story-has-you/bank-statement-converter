import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: "BillingReturn" });
  return { title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}
