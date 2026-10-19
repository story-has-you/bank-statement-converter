import { getTranslations } from "next-intl/server";

import { brandConfig } from "@/config/brand";

export async function OrganizationStructuredData() {
  const t = await getTranslations("Editorial.pages.about");
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": brandConfig.organizationId,
    name: brandConfig.name,
    url: brandConfig.url,
    logo: `${brandConfig.url}/logo.svg`,
    description: t("intro"),
    sameAs: brandConfig.sameAs,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />;
}
