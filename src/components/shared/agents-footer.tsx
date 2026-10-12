import { getLocale, getTranslations } from "next-intl/server";

import { AiChatLinks } from "@/components/shared/ai-chat-links";
import type { AppLocale } from "@/i18n/routing";
import { agentDocuments, getAgentDocumentUrl } from "@/lib/geo/links";

export async function AgentsFooter() {
  const locale = (await getLocale()) as AppLocale;
  const [t, languages] = await Promise.all([getTranslations({ locale, namespace: "Geo" }), getTranslations({ locale, namespace: "LanguageSwitcher" })]);
  const prompt = t("prompt", { fullUrl: getAgentDocumentUrl(locale, "llms-full.txt"), indexUrl: getAgentDocumentUrl(locale, "llms.txt"), language: languages(locale) });
  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12" aria-labelledby="agents-title">
      <div className="min-w-0">
        <h2 id="agents-title" className="text-sm font-semibold text-foreground">
          {t("agentsTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6">{t("agentsDescription")}</p>
        <nav className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3" aria-label={t("agentsDescription")}>
          {agentDocuments.map((document) => (
            <a
              key={document}
              href={getAgentDocumentUrl(locale, document)}
              className="w-fit rounded-sm font-mono text-xs underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {document}
            </a>
          ))}
        </nav>
      </div>
      <AiChatLinks prompt={prompt} />
    </section>
  );
}
