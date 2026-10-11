import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { subscriptionConfig } from "@/config/plans";
import { siteConfig } from "@/config/site";
import { getLocalizedPath } from "@/i18n/metadata";
import { routing, type AppLocale } from "@/i18n/routing";
import { getHomeFaq } from "@/lib/geo/faq";
import { getAgentDocumentUrl } from "@/lib/geo/links";
import { membershipTiers } from "@/lib/paypal/config";
import { usageQuotaConfig } from "@/lib/usage/config";

/** Public product facts shared by the homepage and agent documents. */
export const getGeoContent = cache(async (locale: AppLocale) => {
  const [t, home, features, usage, privacy, footer, metadata, languages, format, faq, faqT, pageT] = await Promise.all([
    getTranslations({ locale, namespace: "Geo" }),
    getTranslations({ locale, namespace: "HomeIntro" }),
    getTranslations({ locale, namespace: "HomeFeatures" }),
    getTranslations({ locale, namespace: "UsageTiers" }),
    getTranslations({ locale, namespace: "Privacy" }),
    getTranslations({ locale, namespace: "HomeFooter" }),
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "LanguageSwitcher" }),
    getFormatter({ locale }),
    getHomeFaq(locale),
    getTranslations({ locale, namespace: "HomeFaq" }),
    getTranslations({ locale }),
  ]);
  const limits = siteConfig.conversionLimits;
  const quota = usageQuotaConfig;
  const pageUrl = (path: string) => `${siteConfig.url}${getLocalizedPath(locale, path)}`;
  const officialPages = [
    { name: metadata("brand"), href: pageUrl("/") },
    { name: footer("privacy"), href: pageUrl("/privacy") },
  ];
  const plans = membershipTiers.map((tier) => ({
    tier,
    name: usage(`plans.${tier}.name`),
    price: subscriptionConfig[tier].monthlyPrice,
    pages: quota.subscriptions[tier].pages,
    formattedPrice: format.number(subscriptionConfig[tier].monthlyPrice, {
      style: "currency", currency: "USD",
    }),
    period: t("billingPeriod"),
  }));
  return {
    locale,
    brand: metadata("brand"),
    title: home("title"),
    glance: t("glance"),
    summary: [
      t("conversionSummary"),
      t("limitsSummary", limits),
      t("quotaSummary", {
        anonymousPages: quota.anonymous.pages,
        authenticatedPages: quota.authenticated.pages,
        price: format.number(subscriptionConfig.standard.monthlyPrice, {
          minimumFractionDigits: 2, maximumFractionDigits: 2,
        }),
      }),
      t("privacySummary"),
    ],
    features: {
      title: features("title"), answer: t("featuresAnswer"),
      items: (["security", "banks", "accuracy"] as const).map((id) => ({
        id, title: features(`${id}Title`), answer: features(`${id}Description`),
      })),
    },
    risks: {
      title: t("riskTitle"), answer: t("riskAnswer"),
      items: [
        { code: "OK", definition: t("okDefinition") },
        { code: "DISCREPANCY", definition: t("discrepancyDefinition") },
        { code: "UNVERIFIABLE", definition: t("unverifiableDefinition") },
      ],
    },
    limits: { title: t("limitsTitle"), answer: t("limitsAnswer", limits) },
    pricing: {
      title: usage("title"), answer: t("pricingAnswer"), note: t("billingNote"),
      headers: [t("planHeader"), t("priceHeader"), t("quotaHeader"), t("periodHeader")],
      rows: [
        { name: usage("anonymous"), formattedPrice: t("freePrice"), pages: quota.anonymous.pages, period: t("dailyPeriod") },
        { name: usage("signedIn"), formattedPrice: t("freePrice"), pages: quota.authenticated.pages, period: t("dailyPeriod") },
        ...plans,
      ],
      plans,
    },
    faq: { title: faqT("title"), answer: t("faqAnswer"), items: faq },
    privacy: {
      title: t("privacyTitle"), answer: t("privacyAnswer"),
      documents: privacy("retention.documents"),
      browserTitle: t("browserTitle"), browserAnswer: t("browserAnswer"),
      metadataTitle: t("metadataTitle"), metadataAnswer: t("metadataAnswer"),
      technicalData: t("analyticsAnswer"),
    },
    site: {
      title: t("siteTitle"), answer: t("siteAnswer"),
      officialPages,
      links: [
        ...officialPages,
        { name: footer("plans"), href: pageUrl("/#plans") },
        { name: footer("faq"), href: pageUrl("/#faq") },
        { name: footer("terms"), href: pageUrl("/terms") },
        { name: pageT("Account.title"), href: pageUrl("/account") },
        { name: pageT("ConversionResult.eyebrow"), href: pageUrl("/result") },
      ],
    },
    documents: [
      { name: "index.md", label: t("indexLabel") },
      { name: "pricing.md", label: t("pricingLabel") },
      { name: "privacy.md", label: t("privacyLabel") },
      { name: "faq.md", label: t("faqLabel") },
      { name: "site.md", label: t("siteLabel") },
    ] as const,
    languageLinks: routing.locales.map((language) => ({
      name: languages(language), href: getAgentDocumentUrl(language, "llms.txt"),
    })),
    languagesLabel: t("languagesLabel"),
    agentsTitle: t("agentsTitle"),
    agentsDescription: t("agentsDescription"),
    homepage: pageUrl("/"),
  };
});
