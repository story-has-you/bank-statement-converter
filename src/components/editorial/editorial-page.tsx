import { getFormatter, getTranslations } from "next-intl/server";

import { HomeHeader } from "@/components/shared/home-header";
import { HomeFooter } from "@/components/shared/home-footer";
import { RelatedConversionPages } from "@/components/landing/related-conversion-pages";
import { EditorialStructuredData } from "@/components/editorial/editorial-structured-data";
import { ComparisonTable } from "@/components/editorial/comparison-table";
import { BalanceChecker } from "@/components/tools/balance-checker";
import { BenchmarkResults } from "@/components/editorial/benchmark-results";
import { ClientMessages } from "@/components/shared/client-messages";
import { brandConfig } from "@/config/brand";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { getEditorialContent, type EditorialParams } from "@/lib/seo/editorial-content";

export async function EditorialPage({ params }: { params: EditorialParams }) {
  const c = await getEditorialContent(params);
  const [t, format] = await Promise.all([
    getTranslations({ locale: c.locale, namespace: "Editorial" }),
    getFormatter({ locale: c.locale }),
  ]);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <EditorialStructuredData content={c} />
      <HomeHeader />
      <main id="main" className="flex-1">
        <article className="mx-auto flex w-full max-w-4xl flex-col gap-9 px-5 py-12 sm:px-8">
          <header className="grid gap-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{c.title}</h1>
            <p className="text-base leading-8 text-muted-foreground">{c.intro}</p>
            <p className="text-sm text-muted-foreground">
              {t("byline", { author: brandConfig.name })} ·{" "}
              <time dateTime={c.page.checkedOn}>
                {t("updated", { date: format.dateTime(new Date(`${c.page.checkedOn}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" }) })}
              </time>
            </p>
          </header>
          {c.page.kind === "tool" && (
            <ClientMessages namespaces={["BalanceChecker"]}>
              <BalanceChecker />
            </ClientMessages>
          )}
          {c.page.kind === "comparison" && <ComparisonTable id={c.page.id} />}
          {c.page.kind === "research" && <BenchmarkResults />}
          {c.sections.map((s, i) => (
            <section key={i} className="grid gap-3">
              <h2 className="text-xl font-semibold">{s.title}</h2>
              <p className="whitespace-pre-line text-sm leading-8 text-muted-foreground">{s.text}</p>
            </section>
          ))}
          {c.page.kind === "about" && (
            <section className="grid gap-3">
              <h2 className="text-xl font-semibold">{t("officialProfiles")}</h2>
              {brandConfig.sameAs.map((url) => (
                <a key={url} href={url} className="break-all underline underline-offset-4">
                  {url}
                </a>
              ))}
              <a href={siteConfig.contactHref} className="break-all underline underline-offset-4">
                {siteConfig.contactEmail}
              </a>
            </section>
          )}
          <section className="grid gap-5">
            <h2 className="text-xl font-semibold">{t("faq")}</h2>
            {c.faq.map((q) => (
              <div key={q.question} className="grid gap-2">
                <h3 className="font-medium">{q.question}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{q.answer}</p>
              </div>
            ))}
          </section>
          {c.page.sources.length > 0 && (
            <section className="grid gap-3">
              <h2 className="text-xl font-semibold">{t("sources")}</h2>
              {c.page.sources.map((url) => (
                <a key={url} href={url} className="break-all text-sm underline underline-offset-4">
                  {url}
                </a>
              ))}
            </section>
          )}
          <Link href="/#workspace" className="w-fit rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
            {t("convert")}
          </Link>
        </article>
        <RelatedConversionPages current={c.page.id} />
      </main>
      <HomeFooter />
    </div>
  );
}
