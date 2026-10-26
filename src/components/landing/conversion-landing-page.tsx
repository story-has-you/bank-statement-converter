import { getLocale } from "next-intl/server";

import { PdfUpload } from "@/components/conversion/pdf-upload";
import { UsageTiers } from "@/components/home/usage-tiers";
import { HomeFooter } from "@/components/shared/home-footer";
import { HomeHeader } from "@/components/shared/home-header";
import { ClientMessages } from "@/components/shared/client-messages";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingGuide } from "@/components/landing/landing-guide";
import { LandingIntro } from "@/components/landing/landing-intro";
import { LandingPlanLink } from "@/components/landing/landing-plan-link";
import { QuickbooksGuide } from "@/components/landing/quickbooks-guide";
import { QuickbooksCsvExamples } from "@/components/landing/quickbooks-csv-examples";
import { LandingRequirements } from "@/components/landing/landing-requirements";
import { LandingSources } from "@/components/landing/landing-sources";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingStructuredData } from "@/components/landing/landing-structured-data";
import { RelatedConversionPages } from "@/components/landing/related-conversion-pages";
import type { ConversionPageId } from "@/config/conversion-pages";
import type { AppLocale } from "@/i18n/routing";
import { getLandingContent } from "@/lib/seo/landing-content";

export async function ConversionLandingPage({ id }: { id: ConversionPageId }) {
  const locale = (await getLocale()) as AppLocale;
  const content = await getLandingContent(locale, id);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingStructuredData content={content} locale={locale} />
      <HomeHeader />
      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-4xl px-5 pb-12 pt-10 sm:px-8">
          <LandingIntro content={content} />
          {id !== "quickbooks" && <LandingPlanLink id={id} />}
          <ClientMessages namespaces={["PdfUpload"]}>
            <PdfUpload showFreeQuota={id !== "scanned"} />
          </ClientMessages>
          {id === "quickbooks" && <LandingPlanLink id={id} />}
        </section>
        {content.quickbooks ? (
          <QuickbooksGuide content={content} guide={content.quickbooks} />
        ) : (
          <>
            <LandingGuide content={content} />
            <LandingSteps content={content} />
            {id === "quickbooks" && <QuickbooksCsvExamples />}
          </>
        )}
        {id !== "quickbooks" && <LandingRequirements content={content} />}
        <UsageTiers />
        {id === "quickbooks" && <LandingRequirements content={content} />}
        <LandingFaq content={content} />
        <LandingSources content={content} />
        <RelatedConversionPages current={id} />
      </main>
      <HomeFooter />
    </div>
  );
}
