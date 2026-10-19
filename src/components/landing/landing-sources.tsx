import { getFormatter, getTranslations } from "next-intl/server";

import type { LandingContent } from "@/lib/seo/landing-content";

export async function LandingSources({ content }: { content: LandingContent }) {
  const [t, editorial, format] = await Promise.all([getTranslations("Landing"), getTranslations("Editorial"), getFormatter()]);
  const date = format.dateTime(new Date(`${content.page.checkedOn}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" });
  return (
    <section className="border-t border-border" aria-label={t("sourcesTitle")}>
      <div className="mx-auto w-full max-w-4xl px-5 py-8 text-sm leading-6 text-muted-foreground sm:px-8">
        <p>
          {editorial("byline", { author: "StatementXL" })} · {t("updated", { date })}
        </p>
        {content.bank && <p className="mt-3">{t("disclaimer", { bank: content.bank })}</p>}
        {content.page.sources.length > 0 && (
          <>
            <h2 className="mt-5 font-medium text-foreground">{t("sourcesTitle")}</h2>
            <ul className="mt-2 grid gap-2">
              {content.page.sources.map((url) => (
                <li key={url}>
                  <a href={url} className="break-all underline underline-offset-4">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
