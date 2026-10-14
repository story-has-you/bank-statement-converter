import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { conversionLimits } from "@/config/conversion";
import { conversionPages, type ConversionPageId } from "@/config/conversion-pages";
import { freeQuotaConfig } from "@/config/plans";
import type { AppLocale } from "@/i18n/routing";
import { getGeoContent } from "@/lib/geo/content";

/** One public content source for visible sections, metadata and structured data. */
export const getLandingContent = cache(async (locale: AppLocale, id: ConversionPageId) => {
  const [t, p, geo] = await Promise.all([getTranslations({ locale, namespace: "Landing" }), getTranslations({ locale, namespace: `Landing.pages.${id}` }), getGeoContent(locale)]);
  const page = conversionPages.find((item) => item.id === id)!;
  const bank = page.path.startsWith("/banks/") ? p("bank") : null;
  let guides = bank
    ? [
        { id: "availability", title: t("availabilityTitle", { bank }), text: p("availability") },
        { id: "download", title: t("bankDownloadTitle", { bank }), text: p("download") },
        { id: "details", title: p("detailsTitle"), text: p("details") },
      ]
    : [];
  let steps = [
    { id: "upload", title: t("uploadTitle"), text: t("uploadText", conversionLimits) },
    { id: "review", title: t("reviewTitle"), text: geo.risks.answer },
    { id: "download", title: t("downloadTitle"), text: t("downloadText") },
  ];
  let stepsTitle = t("stepsTitle");
  if (id === "scanned" || id === "quickbooks") {
    guides = (["requirements", "preparation", "limitations"] as const).map((section) => ({ id: section, title: p(`${section}Title`), text: p(section) }));
    stepsTitle = p("stepsTitle");
    steps = (["upload", "review", "download"] as const).map((step) => ({ id: step, title: p(`steps.${step}.title`), text: p(`steps.${step}.text`, conversionLimits) }));
    if (id === "quickbooks") steps.push({ id: "import", title: p("steps.import.title"), text: p("steps.import.text") });
  }
  const faq = [
    ...(bank ? [{ id: "history", question: t("historyQuestion", { bank }), answer: p("availability") }] : []),
    ...(id === "scanned" || id === "quickbooks" ? guides.map((guide) => ({ id: guide.id, question: guide.title, answer: guide.text })) : []),
    { id: "formats", question: t("formatsQuestion"), answer: t("downloadText") },
    ...geo.faq.items,
  ];
  return {
    page,
    bank,
    label: p("label"),
    title: p("title"),
    intro: p("intro", { anonymousPages: freeQuotaConfig.anonymous.pages, authenticatedPages: freeQuotaConfig.authenticated.pages }),
    guides,
    steps,
    stepsTitle,
    faq,
    geo,
  };
});

export type LandingContent = Awaited<ReturnType<typeof getLandingContent>>;
