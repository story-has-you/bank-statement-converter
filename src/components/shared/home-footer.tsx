import { useTranslations } from "next-intl";

import { AgentsFooter } from "@/components/shared/agents-footer";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Link } from "@/i18n/navigation";

export function HomeFooter() {
  const t = useTranslations("HomeFooter");

  return (
    <footer className="border-t border-border px-5 py-8 text-xs text-muted-foreground sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <AgentsFooter />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7">
          <div className="flex items-center gap-2">
            <BrandLogo className="size-6 shrink-0" />
            <span>{t("brand")}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={t("navigation")}>
            <Link className="hover:text-foreground" href="/#plans">{t("plans")}</Link>
            <Link className="hover:text-foreground" href="/#faq">{t("faq")}</Link>
            <Link className="hover:text-foreground" href="/terms">{t("terms")}</Link>
            <Link className="hover:text-foreground" href="/privacy">{t("privacy")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
