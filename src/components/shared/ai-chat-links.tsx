"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AiProviderIcon } from "@/components/shared/ai-provider-icon";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { getAiChatLinks } from "@/lib/geo/links";

type AiChatLinksProps = {
  prompt: string;
  description: string;
  labels: {
    showPrompt: string;
    linkInstructions: string;
    pasteInstructions: string;
    copyPrompt: string;
    copying: string;
    copied: string;
    copyFailed: string;
  };
};

export function AiChatLinks({ prompt, description, labels }: AiChatLinksProps) {
  const id = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const providers = getAiChatLinks(prompt);

  async function copyPrompt() {
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
      if (detailsRef.current) {
        detailsRef.current.open = true;
      }
      promptRef.current?.focus();
      promptRef.current?.select();
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="max-w-xl text-sm leading-6">{description}</p>
      <div role="group" aria-labelledby={`${id}-link-instructions`} className="flex flex-col gap-3">
        <p id={`${id}-link-instructions`} className="text-xs leading-5">
          {labels.linkInstructions}
        </p>
        <div className="flex flex-wrap gap-3">
          {providers
            .filter((provider) => provider.promptMode === "link")
            .map((provider) => (
              <Button
                key={provider.name}
                variant="outline"
                render={<a href={provider.href} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
                aria-describedby={`${id}-link-instructions`}
              >
                <AiProviderIcon provider={provider.name} />
                {provider.name}
              </Button>
            ))}
        </div>
      </div>
      <div role="group" aria-labelledby={`${id}-paste-instructions`} className="flex flex-col gap-3">
        <p id={`${id}-paste-instructions`} className="text-xs leading-5">
          {labels.pasteInstructions}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={copyPrompt} disabled={copyState === "copying"} aria-describedby={`${id}-copy-status`}>
            {copyState === "copying" ? labels.copying : labels.copyPrompt}
          </Button>
          <p id={`${id}-copy-status`} role="status" aria-atomic="true" className="text-xs leading-5">
            {copyState === "copied" ? labels.copied : copyState === "failed" ? labels.copyFailed : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {providers
            .filter((provider) => provider.promptMode === "paste")
            .map((provider) => (
              <Button
                key={provider.name}
                variant="outline"
                render={<a href={provider.href} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
                aria-describedby={`${id}-paste-instructions`}
              >
                <AiProviderIcon provider={provider.name} />
                {provider.name}
              </Button>
            ))}
        </div>
      </div>
      <details ref={detailsRef} className="text-xs">
        <summary className="w-fit cursor-pointer rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          {labels.showPrompt}
        </summary>
        <FieldGroup className="mt-3">
          <Field>
            <FieldLabel htmlFor={`${id}-prompt`} className="sr-only">
              {labels.showPrompt}
            </FieldLabel>
            <textarea
              ref={promptRef}
              id={`${id}-prompt`}
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
