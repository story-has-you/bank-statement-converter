import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { HomeFaq } from "@/components/home/home-faq";
import { HomeFeatures } from "@/components/home/home-features";
import { HomeFooter } from "@/components/shared/home-footer";
import { HomeHeader } from "@/components/shared/home-header";
import { HomeIntro } from "@/components/home/home-intro";
import { HomeStructuredData } from "@/components/home/home-structured-data";
import { PdfUpload } from "@/components/conversion/pdf-upload";
import { UsageTiers } from "@/components/home/usage-tiers";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { getAgentDocumentUrl } from "@/lib/geo/links";

type HomePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords").split(", "),
    alternates: { ...getLocalizedAlternates("/", locale), types: { "text/markdown": getAgentDocumentUrl(locale, "index.md") } },
    openGraph: { type: "website", siteName: t("brand"), title: t("title"), description: t("description"), url: getLocalizedAlternates("/", locale).canonical, locale: locale.replace("-", "_") },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
    robots: { index: true, follow: true },
  };
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HomeStructuredData />
      <HomeHeader />

      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-4xl px-5 pb-16 pt-10 sm:px-8 sm:pb-8 sm:pt-8">
          <HomeIntro />
          <PdfUpload />
        </section>

        <HomeFeatures />
        <UsageTiers />
        <HomeFaq />
      </main>

      <HomeFooter />
    </div>
  );
}
