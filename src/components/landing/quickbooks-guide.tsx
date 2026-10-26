import { getTranslations } from "next-intl/server";

import { LandingSteps } from "@/components/landing/landing-steps";
import { QuickbooksCsvExamples } from "@/components/landing/quickbooks-csv-examples";
import { QuickbooksImportErrors } from "@/components/landing/quickbooks-import-errors";
import { Link } from "@/i18n/navigation";
import type { LandingContent } from "@/lib/seo/landing-content";

export async function QuickbooksGuide({ content, guide }: { content: LandingContent; guide: NonNullable<LandingContent["quickbooks"]> }) {
  const t = await getTranslations("Landing.pages.quickbooks");
  return (
    <>
      <LandingSteps content={content} />
      <QuickbooksCsvExamples />
      <section className="border-t border-border" aria-labelledby="quickbooks-upload-title">
        <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-12 sm:px-8">
          <h2 id="quickbooks-upload-title" className="text-xl font-semibold">
            {guide.upload.title}
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">{guide.scopeNote}</p>
          {guide.upload.sections.map((section) => (
            <div key={section.id} className="grid gap-3">
              <h3 className="font-medium">{section.title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{section.text}</p>
            </div>
          ))}
        </div>
      </section>
      <QuickbooksImportErrors content={guide.errors} />
      <section className="border-t border-border" aria-labelledby="quickbooks-desktop-title">
        <div className="mx-auto grid w-full max-w-4xl gap-4 px-5 py-12 sm:px-8">
          <h2 id="quickbooks-desktop-title" className="text-xl font-semibold">
            {guide.desktop.title}
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">{guide.desktop.text}</p>
          <p className="text-sm leading-7">{guide.desktop.path}</p>
          <h3 className="font-medium">{guide.desktop.batchTitle}</h3>
          <p className="text-sm leading-7 text-muted-foreground">{guide.desktop.batchText}</p>
          <p className="text-sm leading-7 text-muted-foreground">{guide.desktop.otherEditions}</p>
        </div>
      </section>
      <section className="border-t border-border" aria-labelledby="quickbooks-compare-title">
        <div className="mx-auto grid w-full max-w-4xl gap-6 px-5 py-12 sm:px-8">
          <h2 id="quickbooks-compare-title" className="text-xl font-semibold">
            {guide.compare.title}
          </h2>
          {guide.compare.sections.map((section) => (
            <div key={section.id} className="grid gap-3">
              <h3 className="font-medium">{section.title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{section.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-t border-border" aria-labelledby="quickbooks-before-import-title">
        <div className="mx-auto grid w-full max-w-4xl gap-4 px-5 py-12 sm:px-8">
          <h2 id="quickbooks-before-import-title" className="text-xl font-semibold">
            {guide.beforeImportTitle}
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            {t.rich("beforeImport.balance", {
              checker: (chunks) => (
                <Link href="/tools/bank-statement-balance-checker" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            {t.rich("beforeImport.scanned", {
              scanned: (chunks) => (
                <Link href="/scanned-bank-statement-to-excel" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </section>
    </>
  );
}
