"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConversionProgress } from "@/components/conversion/conversion-progress";
import { useConversion } from "@/components/conversion/conversion-provider";
import { ConversionWorkspace } from "@/components/conversion/conversion-workspace";
import { useResultLeaveConfirmation } from "@/components/conversion/use-result-leave-confirmation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { canDownloadResult } from "@/lib/conversion-export";
import { readConversionPayload } from "@/lib/conversion-storage";
import type { ConversionPayload } from "@/lib/conversion-types";

export function ConversionResult() {
  const t = useTranslations("ConversionResult");
  const conversion = useConversion();
  const [restored, setRestored] = useState<{ revision: number; payload: ConversionPayload | null } | null>(null);

  useEffect(() => {
    if (conversion.state.phase !== "idle") {
      return;
    }
    const loadPayload = window.setTimeout(() => {
      setRestored({ revision: conversion.revision, payload: readConversionPayload() });
    }, 0);

    return () => window.clearTimeout(loadPayload);
  }, [conversion.state.phase, conversion.revision]);

  let payload: ConversionPayload | null = null;
  if (conversion.state.phase === "complete") {
    payload = { version: 1, filename: conversion.state.filename, result: conversion.state.result };
  } else if (conversion.state.phase === "idle" && restored?.revision === conversion.revision) {
    payload = restored.payload;
  }
  useResultLeaveConfirmation(payload !== null && canDownloadResult(payload.result), t("leaveConfirmation"));

  if (conversion.state.phase === "pending") {
    return <ConversionProgress filename={conversion.state.filename} preview={conversion.state.preview} onCancel={conversion.reset} />;
  }
  if (conversion.state.phase === "error") {
    return (
      <section className="flex flex-col gap-5">
        <h1 className="break-words font-heading text-3xl font-medium sm:text-4xl">{conversion.state.filename}</h1>
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("stream.failedTitle")}</AlertTitle>
          <AlertDescription>{conversion.state.message}</AlertDescription>
        </Alert>
        <Link href="/" onClick={conversion.reset} className={buttonVariants({ className: "self-start" })}>
          {t("backHome")}
        </Link>
      </section>
    );
  }
  if (conversion.state.phase === "idle" && restored?.revision !== conversion.revision) {
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
        <Link href="/" onClick={conversion.reset} className={buttonVariants({ className: "mt-5" })}>
          {t("backHome")}
        </Link>
      </section>
    );
  }

  return (
    <ConversionWorkspace
      key={conversion.revision}
      payload={payload}
      initialStorageFailed={conversion.state.phase === "complete" && conversion.state.storageFailed}
      onReset={conversion.reset}
    />
  );
}

ConversionResult.displayName = "ConversionResult";
