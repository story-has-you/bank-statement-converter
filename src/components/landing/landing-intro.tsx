import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { LandingContent } from "@/lib/seo/landing-content";

export async function LandingIntro({ content }: { content: LandingContent }) {
  const t = await getTranslations("Landing");
  return (
    <div className="mb-6 grid gap-3">
      <nav aria-label={t("breadcrumbLabel")} className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="underline underline-offset-4">
              {content.geo.brand}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{content.label}</li>
        </ol>
      </nav>
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{content.title}</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{content.intro}</p>
    </div>
  );
}
