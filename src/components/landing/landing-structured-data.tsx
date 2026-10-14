import { getLocalizedAlternates } from "@/i18n/metadata";
import type { AppLocale } from "@/i18n/routing";
import type { LandingContent } from "@/lib/seo/landing-content";

export function LandingStructuredData({ content, locale }: { content: LandingContent; locale: AppLocale }) {
  const url = getLocalizedAlternates(content.page.path, locale).canonical;
  const schemas = [
    { "@context": "https://schema.org", "@type": "WebPage", "@id": `${url}#webpage`, url, name: content.title, description: content.intro, inLanguage: locale, dateModified: content.page.checkedOn },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: content.geo.brand, item: content.geo.homepage },
        { "@type": "ListItem", position: 2, name: content.label, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: content.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: content.stepsTitle,
      inLanguage: locale,
      step: content.steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.title, text: step.text, url: `${url}#step-${step.id}` })),
    },
  ];
  return (
    <>
      {schemas.map((schema) => (
        <script key={schema["@type"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      ))}
    </>
  );
}
