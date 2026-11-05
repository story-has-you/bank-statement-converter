"use client";

import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConversionProgress } from "@/components/conversion/conversion-progress";
import { useConversionActions } from "@/components/conversion/conversion-provider";
import { ConversionWorkspace } from "@/components/conversion/conversion-workspace";
import { useResultLeaveConfirmation } from "@/components/conversion/use-result-leave-confirmation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { canDownloadResult } from "@/lib/conversion-export";
import { readConversionPayload } from "@/lib/conversion-storage";
import { conversionRevisionAtom, conversionStateAtom } from "@/lib/conversion-state";
import type { ConversionPayload } from "@/lib/conversion-types";

export function ConversionResult() {
  const t = useTranslations("ConversionResult");
  const { reset } = useConversionActions();
  const state = useAtomValue(conversionStateAtom);
  const revision = useAtomValue(conversionRevisionAtom);
  const [restored, setRestored] = useState<{ revision: number; payload: ConversionPayload | null } | null>(null);

  useEffect(() => {
    if (state.phase !== "idle") {
      return;
    }
    const loadPayload = window.setTimeout(() => {
      setRestored({ revision, payload: readConversionPayload() });
    }, 0);

    return () => window.clearTimeout(loadPayload);
  }, [state.phase, revision]);

  let payload: ConversionPayload | null = null;
  if (state.phase === "complete") {
    payload = { version: 1, filename: state.filename, result: state.result };
  } else if (state.phase === "idle" && restored?.revision === revision) {
    payload = restored.payload;
  }
  useResultLeaveConfirmation(payload !== null && canDownloadResult(payload.result), t("leaveConfirmation"));

  if (state.phase === "pending") {
    return <ConversionProgress filename={state.filename} preview={state.preview} onCancel={reset} />;
  }
  if (state.phase === "error") {
    return (
      <section className="flex flex-col gap-5">
        <h1 className="break-words font-heading text-3xl font-medium sm:text-4xl">{state.filename}</h1>
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("stream.failedTitle")}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Link href="/" onClick={reset} className={buttonVariants({ className: "self-start" })}>
          {t("backHome")}
        </Link>
      </section>
    );
  }
  if (state.phase === "idle" && restored?.revision !== revision) {
    return (
      <p role="status" aria-busy="true">
        {t("restoring")}
      </p>
    );
  }

  if (!payload) {
    return (
      <section className="border-y border-border py-12 sm:py-16" aria-labelledby="result-missing-title">
        <h1 id="result-missing-title" className="font-heading text-3xl font-medium sm:text-4xl">
          {t("missing.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("missing.description")}</p>
        <Link href="/" onClick={reset} className={buttonVariants({ className: "mt-5" })}>
          {t("backHome")}
        </Link>
      </section>
    );
  }

  return (
    <ConversionWorkspace
      key={revision}
      payload={payload}
      initialStorageFailed={state.phase === "complete" && state.storageFailed}
      onReset={reset}
    />
  );
}

ConversionResult.displayName = "ConversionResult";
