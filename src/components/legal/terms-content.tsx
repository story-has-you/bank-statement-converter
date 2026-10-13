import { useTranslations } from "next-intl";

import { LegalSection } from "@/components/legal/legal-section";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { usageQuotaConfig } from "@/lib/usage/config";

export function TermsContent() {
  const t = useTranslations("Terms");
  const common = useTranslations("LegalCommon");

  return (
    <article className="max-w-3xl">
      <header className="grid gap-4 pb-7">
        <p className="text-xs font-medium text-muted-foreground">{common("lastUpdated")}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          {t.rich("intro", {
            domain: siteConfig.domain,
            site: (chunks) => (
              <a className="break-all text-primary underline underline-offset-4" href={siteConfig.url}>
                {chunks}
              </a>
            ),
          })}
        </p>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">{t("availability")}</p>
      </header>

      <LegalSection id="service" title={t("service.title")}>
        <p>{t("service.body")}</p>
      </LegalSection>

      <LegalSection id="authorization" title={t("authorization.title")}>
        <p>{t("authorization.body")}</p>
      </LegalSection>

      <LegalSection id="accuracy" title={t("accuracy.title")}>
        <p>{t("accuracy.body")}</p>
      </LegalSection>

      <LegalSection id="quota" title={t("quota.title")}>
        <p>
          {t("quota.body", {
            anonymousPages: usageQuotaConfig.anonymous.pages,
            authenticatedPages: usageQuotaConfig.authenticated.pages,
            standardPages: usageQuotaConfig.subscriptions.standard.pages,
            professionalPages: usageQuotaConfig.subscriptions.professional.pages,
            enterprisePages: usageQuotaConfig.subscriptions.enterprise.pages,
          })}
        </p>
      </LegalSection>

      <LegalSection id="subscription" title={t("subscription.title")}>
        <p>{t("subscription.body")}</p>
      </LegalSection>

      <LegalSection id="refunds" title={t("refunds.title")}>
        <p>{t("refunds.eligibility")}</p>
        <p>{t("refunds.usage")}</p>
        <p>{t("refunds.exceptions")}</p>
        <p>{t("refunds.cancellation")}</p>
        <p>
          {t.rich("refunds.request", {
            email: siteConfig.contactEmail,
            link: (chunks) => (
              <a className="break-all text-primary underline underline-offset-4" href={siteConfig.contactHref}>
                {chunks}
              </a>
            ),
          })}
        </p>
        <p>{t("refunds.processing")}</p>
        <p>{t("refunds.rights")}</p>
      </LegalSection>

      <LegalSection id="files" title={t("files.title")}>
        <p>{t("files.body")}</p>
      </LegalSection>

      <LegalSection id="prohibited" title={t("prohibited.title")}>
        <p>{t("prohibited.body")}</p>
      </LegalSection>

      <LegalSection id="rights" title={t("rights.title")}>
        <p>{t("rights.body")}</p>
      </LegalSection>

      <LegalSection id="liability" title={t("liability.title")}>
        <p>{t("liability.body")}</p>
      </LegalSection>

      <LegalSection id="privacy" title={t("privacy.title")}>
        <p>
          {t.rich("privacy.body", {
            link: (chunks) => (
              <Link className="text-primary underline underline-offset-4" href="/privacy">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </LegalSection>

      <LegalSection id="changes" title={t("changes.title")}>
        <p>{t("changes.body")}</p>
      </LegalSection>

      <LegalSection id="contact" title={t("contact.title")}>
        <p>
          {t.rich("contact.body", {
            email: siteConfig.contactEmail,
            link: (chunks) => (
              <a className="break-all text-primary underline underline-offset-4" href={siteConfig.contactHref}>
                {chunks}
              </a>
            ),
          })}
        </p>
      </LegalSection>
    </article>
  );
}
