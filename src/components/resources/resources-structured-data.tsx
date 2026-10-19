import { getLocale, getTranslations } from "next-intl/server";

import { brandConfig } from "@/config/brand";
import { resourceGroups, getResourcePage } from "@/config/resources";
import { getLocalizedAlternates } from "@/i18n/metadata";
import type { AppLocale } from "@/i18n/routing";

export async function ResourcesStructuredData() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Resources")]);
  const language = locale as AppLocale;
  const url = getLocalizedAlternates("/resources", language).canonical;
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      url,
      name: t("title"),
      description: t("intro"),
      inLanguage: locale,
      publisher: { "@id": brandConfig.organizationId },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: resourceGroups
          .flatMap((group) => group.pageIds)
          .map((id, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: { "@type": "WebPage", name: t(`links.${id}`), url: getLocalizedAlternates(getResourcePage(id).path, language).canonical },
          })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: brandConfig.name, item: getLocalizedAlternates("/", language).canonical },
        { "@type": "ListItem", position: 2, name: t("title"), item: url },
      ],
    },
  ];
  return (
    <>
      {schemas.map((schema) => (
        <script
          key={schema["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
