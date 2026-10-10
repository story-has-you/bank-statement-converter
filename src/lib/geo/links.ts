import { siteConfig } from "@/config/site";
import { routing, type AppLocale } from "@/i18n/routing";

export const agentDocuments = [
  "llms.txt", "llms-full.txt", "index.md", "pricing.md", "privacy.md", "faq.md", "site.md",
] as const;

export type AgentDocument = (typeof agentDocuments)[number];

export function getAgentDocumentUrl(locale: AppLocale, document: AgentDocument): string {
  if (locale === routing.defaultLocale && document.endsWith(".txt")) {
    return `${siteConfig.url}/${document}`;
  }
  return `${siteConfig.url}/ai/${locale}/${document}`;
}

export function getAiChatLinks(prompt: string) {
  const query = encodeURIComponent(prompt);
  return [
    { name: "ChatGPT", href: `https://chatgpt.com/?q=${query}`, prefilled: true },
    { name: "Claude", href: "https://claude.ai/new", prefilled: false },
    { name: "Perplexity", href: `https://www.perplexity.ai/search?q=${query}`, prefilled: true },
    { name: "Gemini", href: "https://gemini.google.com/app", prefilled: false },
    { name: "Grok", href: "https://grok.com/", prefilled: false },
  ] as const;
}
