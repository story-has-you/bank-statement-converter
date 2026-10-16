"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, FileSpreadsheetIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ConversionProgress } from "@/components/conversion/conversion-progress";
import { useConversion } from "@/components/conversion/conversion-provider";
import { ConversionReview } from "@/components/conversion/conversion-review";
import { ConversionDownloads } from "@/components/conversion/conversion-downloads";
import { useResultLeaveConfirmation } from "@/components/conversion/use-result-leave-confirmation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { canDownloadResult } from "@/lib/conversion-export";
import { readConversionPayload } from "@/lib/conversion-storage";
import { getParseErrorKey } from "@/lib/parse-issues";
import type { ConversionPayload, SummaryStatus } from "@/lib/conversion-types";

export function ConversionResult() {
  const t = useTranslations("ConversionResult");
  const format = useFormatter();
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
  const hasRows = payload?.result.tables.some((table) => table.rows.length > 0) ?? false;
  useResultLeaveConfirmation(payload !== null && canDownloadResult(payload.result), t("leaveConfirmation"));

  if (conversion.state.phase === "pending") {
    return <ConversionProgress filename={conversion.state.filename} preview={conversion.state.preview} onCancel={conversion.reset} />;
  }
  if (conversion.state.phase === "error") {
    return (
      <section className="flex flex-col gap-5">
        <h1 className="break-all text-xl font-semibold">{conversion.state.filename}</h1>
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
      <section className="rounded-md border border-border bg-card p-6 shadow-xs" aria-labelledby="result-missing-title">
        <h1 id="result-missing-title" className="text-lg font-semibold">
          {t("missing.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("missing.description")}</p>
        <Link href="/" onClick={conversion.reset} className={buttonVariants({ className: "mt-5" })}>
          {t("backHome")}
        </Link>
      </section>
    );
  }

  const { result } = payload;
  const hasRiskRows = result.summary.warningRowCount + result.summary.failedRowCount > 0;

  function getStatusLabel(status: SummaryStatus): string {
    if (status === "partial") {
      return t("summaryStatus.partial");
    }
    if (status === "failed") {
      return t("summaryStatus.failed");
    }
    return t("summaryStatus.success");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
            <FileSpreadsheetIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("eyebrow")}</p>
            <h1 className="truncate text-xl font-semibold" title={payload.filename}>
              {payload.filename}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <ConversionDownloads filename={payload.filename} result={result} />
      </div>

      {hasRiskRows && (
        <Alert>
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("partial.title")}</AlertTitle>
          <AlertDescription>
            {t("partial.description")}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{t("partial.discrepancyCount", { count: result.summary.warningRowCount })}</Badge>
              <Badge variant="outline">
                <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
                {t("partial.unverifiableCount", { count: result.summary.failedRowCount })}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!hasRows && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("empty.title")}</AlertTitle>
          <AlertDescription>{t("empty.description")}</AlertDescription>
        </Alert>
      )}

      {result.errors.length > 0 && (
        <Alert>
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("pageRisks.title")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {result.errors.map((error, index) => (
                <li key={`${error.code}-${error.page ?? "document"}-${index}`}>
                  {t(getParseErrorKey(error.code), { page: error.page ?? "?" })}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.status")}</dt>
          <dd className="mt-1">
            <Badge variant={result.summary.status === "failed" ? "destructive" : "secondary"}>
              {getStatusLabel(result.summary.status)}
            </Badge>
          </dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.pages")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.pageCount)}</dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.tables")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.summary.tableCount)}</dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.rows")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.summary.rowCount)}</dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.warnings")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.summary.warningRowCount + result.summary.failedRowCount)}</dd>
        </div>
      </dl>

      <ConversionReview key={conversion.revision} result={result} />

      <div className="flex justify-start">
        <Link href="/" onClick={conversion.reset} className={buttonVariants()}>
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}

ConversionResult.displayName = "ConversionResult";
