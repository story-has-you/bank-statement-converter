import { useTranslations } from "next-intl";

import { LegalSection } from "@/components/legal/legal-section";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";

export function PrivacyContent() {
  const t = useTranslations("Privacy");
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

      <LegalSection id="documents" title={t("documents.title")}>
        <p>{t("documents.body")}</p>
      </LegalSection>

      <LegalSection id="ai-parsing" title={t("aiParsing.title")}>
        <p>{t("aiParsing.body")}</p>
      </LegalSection>

      <LegalSection id="account-data" title={t("accountData.title")}>
        <p>{t("accountData.body")}</p>
      </LegalSection>

      <LegalSection id="technical-data" title={t("technicalData.title")}>
        <p>{t("technicalData.body")}</p>
      </LegalSection>

      <LegalSection id="purposes" title={t("purposes.title")}>
        <p>{t("purposes.body")}</p>
      </LegalSection>

      <LegalSection id="retention" title={t("retention.title")}>
        <p>{t("retention.documents")}</p>
        <p>{t("retention.metadata")}</p>
      </LegalSection>

      <LegalSection id="providers" title={t("providers.title")}>
        <p>{t("providers.body")}</p>
      </LegalSection>

      <LegalSection id="storage" title={t("storage.title")}>
        <p>{t("storage.body")}</p>
      </LegalSection>

      <LegalSection id="security" title={t("security.title")}>
        <p>{t("security.body")}</p>
      </LegalSection>

      <LegalSection id="rights" title={t("rights.title")}>
        <p>{t("rights.body")}</p>
      </LegalSection>

      <LegalSection id="terms" title={t("terms.title")}>
        <p>
          {t.rich("terms.body", {
            link: (chunks) => (
              <Link className="text-primary underline underline-offset-4" href="/terms">
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
