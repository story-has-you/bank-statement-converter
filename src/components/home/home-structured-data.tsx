import { getLocale, getTranslations } from "next-intl/server";

import { brandConfig } from "@/config/brand";
import { subscriptionConfig } from "@/config/plans";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing, type AppLocale } from "@/i18n/routing";
import { getHomeFaq } from "@/lib/geo/faq";
import { membershipTiers } from "@/lib/billing/config";

export async function HomeStructuredData() {
  const locale = (await getLocale()) as AppLocale;
  const [metadataT, usageT, geo, faq] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "UsageTiers" }),
    getTranslations({ locale, namespace: "Geo" }),
    getHomeFaq(locale),
  ]);
  const questions = faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  }));
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: metadataT("brand"),
      alternateName: metadataT("alternateName"),
      url: getLocalizedAlternates("/", locale).canonical,
      description: metadataT("description"),
      applicationCategory: "FinanceApplication",
      publisher: { "@id": brandConfig.organizationId },
      operatingSystem: "Web",
      inLanguage: locale,
      availableLanguage: routing.locales,
      offers: membershipTiers.map((tier) => {
        const parsing = usageT(subscriptionConfig[tier].aiParsing ? "aiParsing" : "textParsing");
        return {
          "@type": "Offer",
          name: usageT(`plans.${tier}.name`),
          price: subscriptionConfig[tier].monthlyPrice,
          priceCurrency: "USD",
          description: `${usageT("perMonth")}. ${parsing}. ${geo("billingNote")}`,
          url: `${getLocalizedAlternates("/", locale).canonical}#plans`,
          category: "Subscription",
        };
      }),
    },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      publisher: { "@id": brandConfig.organizationId },
      name: metadataT("brand"),
      url: getLocalizedAlternates("/", locale).canonical,
      inLanguage: locale,
    },
  ];
  return (
    <>
      {schemas.map((schema) => (
        <script
          key={schema["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
