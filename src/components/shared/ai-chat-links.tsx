"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { AiProviderIcon } from "@/components/shared/ai-provider-icon";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { getAiChatLinks } from "@/lib/geo/links";

type AiChatLinksProps = { prompt: string };

export function AiChatLinks({ prompt }: AiChatLinksProps) {
  const t = useTranslations("Geo");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="max-w-xl text-sm leading-6">{t("chatDescription")}</p>
      <div className="flex items-center gap-3">
        {getAiChatLinks(prompt).map((provider) => (
          <Button
            key={provider.name}
            variant="outline"
            size="icon-lg"
            render={<a href={provider.href} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
            aria-label={provider.name}
            title={provider.name}
          >
            <AiProviderIcon provider={provider.name} />
          </Button>
        ))}
      </div>
      <details className="text-xs">
        <summary className="w-fit cursor-pointer rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{t("showPrompt")}</summary>
        <FieldGroup className="mt-3">
          <Field>
            <FieldLabel htmlFor="ai-default-prompt" className="sr-only">
              {t("showPrompt")}
            </FieldLabel>
            <textarea
              id="ai-default-prompt"
              readOnly
              value={prompt}
              rows={7}
              className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-6 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
        </FieldGroup>
      </details>
    </div>
  );
}
