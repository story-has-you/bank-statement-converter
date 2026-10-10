import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getGeoContent } from "@/lib/geo/content";
import {
  agentDocuments,
  getAgentDocumentUrl,
  type AgentDocument,
} from "@/lib/geo/links";

function tableCell(value: string | number): string {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Render only allowlisted, public product information; never read account state. */
export async function getAgentDocumentResponse(
  locale: string,
  document: string,
): Promise<Response> {
  if (
    !hasLocale(routing.locales, locale) ||
    !agentDocuments.some((name) => name === document)
  ) {
    return new Response(null, { status: 404 });
  }
  const name = document as AgentDocument;
  const c = await getGeoContent(locale);
  const docLinks = c.documents
    .map((doc) => `- [${doc.label}](${getAgentDocumentUrl(locale, doc.name)})`)
    .join("\n");
  const languageLinks = c.languageLinks
    .map((link) => `- [${link.name}](${link.href})`)
    .join("\n");
  const summary = `> ${c.glance}\n\n${c.summary.map((item) => `- ${item}`).join("\n")}`;
  const officialPageLinks = c.site.officialPages
    .map((link) => `- [${link.name}](${link.href})`)
    .join("\n");
  const faq =
    `## ${c.faq.title}\n\n${c.faq.answer}\n\n` +
    c.faq.items
      .map((item) => `### ${item.question}\n\n${item.answer}`)
      .join("\n\n");
  const navigation =
    `## ${c.site.title}\n\n${c.site.answer}\n\n` +
    `- [${c.brand}](${c.homepage})\n` +
    `- [llms.txt](${getAgentDocumentUrl(locale, "llms.txt")})\n` +
    `- [llms-full.txt](${getAgentDocumentUrl(locale, "llms-full.txt")})\n${docLinks}`;
  const sections = {
    "index.md":
      `## ${c.features.title}\n\n${c.features.answer}\n\n` +
      c.features.items
        .map((item) => `### ${item.title}\n\n${item.answer}`)
        .join("\n\n") +
      `\n\n## ${c.limits.title}\n\n${c.limits.answer}\n\n` +
      `## ${c.risks.title}\n\n${c.risks.answer}\n\n` +
      c.risks.items
        .map((risk) => `> **${risk.code}**: ${risk.definition}`)
        .join("\n\n"),
    "pricing.md":
      `## ${c.pricing.title}\n\n${c.pricing.answer}\n\n` +
      `| ${c.pricing.headers.map(tableCell).join(" | ")} |\n| --- | --- | --- | --- |\n` +
      c.pricing.rows
        .map(
          (row) =>
            `| ${[row.name, row.formattedPrice, row.pages, row.period].map(tableCell).join(" | ")} |`,
        )
        .join("\n") +
      `\n\n${c.pricing.note}`,
    "privacy.md":
      `## ${c.privacy.title}\n\n${c.privacy.answer}\n\n${c.privacy.documents}\n\n` +
      `## ${c.privacy.browserTitle}\n\n${c.privacy.browserAnswer}\n\n` +
      `## ${c.privacy.metadataTitle}\n\n${c.privacy.metadataAnswer}\n\n${c.privacy.technicalData}`,
    "site.md":
      `## ${c.site.title}\n\n${c.site.answer}\n\n` +
      c.site.links.map((link) => `- [${link.name}](${link.href})`).join("\n") +
      `\n\n${c.languagesLabel}\n\n${languageLinks}`,
  };
  let body: string;
  if (name === "llms.txt") {
    body =
      `# ${c.brand}\n\n> ${c.summary[0]}\n\n` +
      c.summary
        .slice(1)
        .map((item) => `- ${item}`)
        .join("\n") +
      `\n\n## ${c.site.title}\n\n${officialPageLinks}` +
      `\n\n## ${c.agentsTitle}\n\n${docLinks}\n` +
      `- [llms-full.txt](${getAgentDocumentUrl(locale, "llms-full.txt")}): ${c.agentsDescription}\n\n` +
      `## ${c.languagesLabel}\n\n${languageLinks}`;
  } else if (name === "llms-full.txt") {
    body = `# ${c.brand}\n\n${summary}\n\n${officialPageLinks}\n\n${Object.values(sections).join("\n\n")}\n\n${navigation}\n\n${faq}`;
  } else if (name === "faq.md") {
    body = `# ${c.faq.title}\n\n${summary}\n\n${navigation}\n\n${faq}`;
  } else {
    const title =
      c.documents.find((doc) => doc.name === name)?.label ?? c.brand;
    body = `# ${title}\n\n${summary}\n\n${sections[name]}\n\n${navigation}\n\n${faq}`;
  }
  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": `${name.endsWith(".txt") ? "text/plain" : "text/markdown"}; charset=utf-8`,
      "Content-Language": locale,
      Link:
        `<${getAgentDocumentUrl(locale, name)}>; rel="canonical", ` +
        `<${getAgentDocumentUrl(locale, "llms.txt")}>; rel="describedby"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
