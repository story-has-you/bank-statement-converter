import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AgentsFooter } from "@/components/shared/agents-footer";
import { BrandLogo } from "@/components/shared/brand-logo";
import { FooterLaunchLinks } from "@/components/shared/footer-launch-links";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";

export function HomeFooter() {
  const t = useTranslations("HomeFooter");

  return (
    <footer className="border-t border-border px-5 py-8 text-xs text-muted-foreground sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <AgentsFooter />
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="size-8 shrink-0" />
              <span className="text-sm font-semibold text-foreground">{t("brand")}</span>
            </div>
            <a
              className="group flex w-fit max-w-full items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              href={siteConfig.contactHref}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary transition-colors group-hover:bg-primary/15">
                <MailIcon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 text-sm leading-6 font-medium text-foreground [overflow-wrap:anywhere] group-hover:text-primary">
                {t.rich("support", {
                  email: siteConfig.contactEmail,
                  label: (chunks) => <span className="block text-xs leading-5 font-normal text-muted-foreground">{chunks}</span>,
                })}
              </span>
            </a>
          </div>
          <div className="mt-6 flex flex-col gap-5 border-t border-border/60 pt-5 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-3" aria-label={t("navigation")}>
              <Link className="hover:text-foreground" href="/#plans">
                {t("plans")}
              </Link>
              <Link className="hover:text-foreground" href="/#faq">
                {t("faq")}
              </Link>
              <Link className="hover:text-foreground" href="/terms">
                {t("terms")}
              </Link>
              <Link className="hover:text-foreground" href="/privacy">
                {t("privacy")}
              </Link>
              <a className="hover:text-foreground" href={siteConfig.contactHref}>
                {t("contactUs")}
              </a>
              <a className="hover:text-foreground" href="https://twelve.tools">
                {t("twelveTools")}
              </a>
            </nav>
            <FooterLaunchLinks />
          </div>
        </div>
      </div>
    </footer>
  );
}
