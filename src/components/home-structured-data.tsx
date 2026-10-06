import { getLocale, getTranslations } from "next-intl/server";

import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { usageQuotaConfig } from "@/lib/usage/config";

const questionIds = ["banks", "accuracy", "quota", "scans", "storage", "failure"] as const;

export async function HomeStructuredData() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "HomeFaq" });
  const usageT = await getTranslations({ locale, namespace: "UsageTiers" });
  const questions = questionIds.map((id) => ({
    "@type": "Question",
    name: t(`${id}.question`),
    acceptedAnswer: {
      "@type": "Answer",
      text:
        id === "quota"
          ? t("quota.answer", {
              anonymousPages: usageQuotaConfig.anonymous.pages,
              authenticatedPages: usageQuotaConfig.authenticated.pages,
              standardPages: usageQuotaConfig.subscriptions.standard.pages,
              professionalPages: usageQuotaConfig.subscriptions.professional.pages,
              enterprisePages: usageQuotaConfig.subscriptions.enterprise.pages,
            })
          : t(`${id}.answer`),
    },
  }));
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Bank Statement Converter",
      alternateName: "Bank Statement PDF to Excel Converter",
      url: getLocalizedAlternates("/", locale).canonical,
      description: (await getTranslations({ locale, namespace: "Metadata" }))("description"),
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      inLanguage: locale,
      availableLanguage: routing.locales,
      offers: {
        "@type": "OfferCatalog",
        name: usageT("title"),
        itemListElement: ["standard", "professional", "enterprise"].map((name) => ({
          "@type": "Offer",
          name,
          category: "Subscription",
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: questions,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Bank Statement Converter",
      url: getLocalizedAlternates("/", locale).canonical,
      inLanguage: locale,
    },
  ];
  const jsonLd = JSON.stringify(schemas).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />;
}
