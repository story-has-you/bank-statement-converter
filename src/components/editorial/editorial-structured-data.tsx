import { brandConfig } from "@/config/brand";
import { getLocalizedAlternates } from "@/i18n/metadata";
import type { EditorialContent } from "@/lib/seo/editorial-content";

export function EditorialStructuredData({ content: c }: { content: EditorialContent }) {
  const url = getLocalizedAlternates(c.page.path, c.locale).canonical;
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": c.page.kind === "about" ? "AboutPage" : "Article",
      "@id": `${url}#article`,
      url,
      headline: c.title,
      description: c.intro,
      inLanguage: c.locale,
      dateModified: c.page.checkedOn,
      author: { "@id": brandConfig.organizationId },
      publisher: { "@id": brandConfig.organizationId },
      citation: c.page.sources,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: c.faq.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: brandConfig.name, item: getLocalizedAlternates("/", c.locale).canonical },
        { "@type": "ListItem", position: 2, name: c.title, item: url },
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
