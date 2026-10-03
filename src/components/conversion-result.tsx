"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, FileSpreadsheetIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConversionTable } from "@/components/conversion-table";
import { ExcelDownload } from "@/components/excel-download";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { consumeConversionPayload } from "@/lib/conversion-storage";
import type { ConversionPayload, SummaryStatus } from "@/lib/conversion-types";

export function ConversionResult() {
  const t = useTranslations("ConversionResult");
  const [payload, setPayload] = useState<ConversionPayload | null>(null);

  useEffect(() => {
    const loadPayload = window.setTimeout(() => {
      setPayload(consumeConversionPayload());
    }, 0);

    return () => window.clearTimeout(loadPayload);
  }, []);

  if (!payload) {
    return (
      <section className="rounded-md border border-border bg-card p-6 shadow-xs" aria-labelledby="result-missing-title">
        <h1 id="result-missing-title" className="text-lg font-semibold">{t("missing.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("missing.description")}</p>
        <Link href="/" className={buttonVariants({ className: "mt-5" })}>
          {t("backHome")}
        </Link>
      </section>
    );
  }

  const { result } = payload;
  const hasRows = result.tables.some((table) => table.rows.length > 0);

  function getStatusLabel(status: SummaryStatus): string {
    if (status === "partial") return t("summaryStatus.partial");
    if (status === "failed") return t("summaryStatus.failed");
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
            <h1 className="truncate text-xl font-semibold" title={payload.filename}>{payload.filename}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <ExcelDownload filename={payload.filename} result={result} />
      </div>

      {result.summary.status === "partial" && (
        <Alert>
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("partial.title")}</AlertTitle>
          <AlertDescription>{t("partial.description")}</AlertDescription>
        </Alert>
      )}

      {!hasRows && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("empty.title")}</AlertTitle>
          <AlertDescription>{t("empty.description")}</AlertDescription>
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.status")}</dt>
          <dd className="mt-1"><Badge variant={result.summary.status === "failed" ? "destructive" : "secondary"}>{getStatusLabel(result.summary.status)}</Badge></dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.pages")}</dt>
          <dd className="mt-1 text-lg font-semibold">{result.pageCount}</dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.tables")}</dt>
          <dd className="mt-1 text-lg font-semibold">{result.summary.tableCount}</dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.rows")}</dt>
          <dd className="mt-1 text-lg font-semibold">{result.summary.rowCount}</dd>
        </div>
        <div className="rounded-md border border-border bg-card p-3 shadow-xs">
          <dt className="text-xs text-muted-foreground">{t("summary.warnings")}</dt>
          <dd className="mt-1 text-lg font-semibold">{result.summary.warningRowCount + result.summary.failedRowCount}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-4">
        {result.tables.map((table) => <ConversionTable key={table.id} table={table} />)}
      </div>

      <div className="flex justify-start">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}

ConversionResult.displayName = "ConversionResult";
