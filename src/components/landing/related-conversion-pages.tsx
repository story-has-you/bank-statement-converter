import { getTranslations } from "next-intl/server";

import { getRelatedResources } from "@/config/resources";
import { Link } from "@/i18n/navigation";

export async function RelatedConversionPages({ current }: { current?: string }) {
  const t = await getTranslations("Resources");
  return (
    <section className="border-t border-border" aria-labelledby="related-pages-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <h2 id="related-pages-title" className="text-xl font-semibold">
          {t(current ? "relatedTitle" : "featuredTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("featuredDescription")}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {getRelatedResources(current).map((page) => (
            <li key={page.id}>
              <Link
                href={page.path}
                className="block rounded-xl border border-border p-4 text-sm font-medium underline-offset-4 hover:bg-muted hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {t(`links.${page.id}`)}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/resources" className="mt-5 inline-block text-sm underline underline-offset-4">
          {t("viewAll")}
        </Link>
      </div>
    </section>
  );
}
