"use client";

import { useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ConversionReview } from "@/components/conversion/conversion-review";
import { ConversionDownloads } from "@/components/conversion/conversion-downloads";
import { ConversionNextSteps } from "@/components/conversion/conversion-next-steps";
import { MerchantNormalizationPanel } from "@/components/conversion/merchant-normalization-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { canDownloadResult, type MerchantExport } from "@/lib/conversion-export";
import { saveConversionPayload } from "@/lib/conversion-storage";
import { hasMerchantNames, type MerchantNormalization } from "@/lib/merchant-normalization";
import { getParseErrorKey } from "@/lib/parse-issues";
import type { ConversionPayload, SummaryStatus } from "@/lib/conversion-types";

type ConversionWorkspaceProps = { payload: ConversionPayload; initialStorageFailed: boolean; onReset: () => void };

export function ConversionWorkspace({ payload, initialStorageFailed, onReset }: ConversionWorkspaceProps) {
  const t = useTranslations("ConversionResult");
  const format = useFormatter();
  const { result } = payload;
  const [normalization, setNormalization] = useState<MerchantNormalization>(payload.merchantNormalization ?? {});
  const [exportRevision, setExportRevision] = useState(0);
  const [storageFailed, setStorageFailed] = useState(initialStorageFailed);
  const merchants: MerchantExport | undefined = hasMerchantNames(normalization)
    ? {
        normalization,
        headers: [t("merchant.name"), t("merchant.status")],
        confirmed: t("merchant.confirmed"),
        unassigned: t("merchant.unassigned"),
      }
    : undefined;

  function updateNormalization(next: MerchantNormalization): void {
    setNormalization(next);
    setExportRevision((revision) => revision + 1);
    try {
      saveConversionPayload(payload.filename, result, next);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }
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
      <div className="flex flex-col gap-5 border-b border-foreground pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="min-w-0">
            <h1 className="break-words font-heading text-3xl font-medium sm:text-4xl" title={payload.filename}>
              {payload.filename}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <ConversionDownloads key={exportRevision} filename={payload.filename} result={result} merchants={merchants} />
      </div>

      {storageFailed && (
        <Alert>
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("storage.title")}</AlertTitle>
          <AlertDescription>{t("storage.description")}</AlertDescription>
        </Alert>
      )}

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

      {!result.tables.some((table) => table.rows.length > 0) && (
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

      <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-5 [&>div]:border-b [&>div]:border-border [&>div]:px-4 [&>div]:py-4 sm:[&>div]:border-b-0 sm:[&>div]:border-r sm:[&>div:first-child]:pl-0 sm:[&>div:last-child]:border-r-0">
        <div>
          <dt className="text-xs text-muted-foreground">{t("summary.status")}</dt>
          <dd className="mt-1">
            <Badge variant={result.summary.status === "failed" ? "destructive" : "secondary"}>
              {getStatusLabel(result.summary.status)}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("summary.pages")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.pageCount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("summary.tables")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.summary.tableCount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("summary.rows")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.summary.rowCount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("summary.warnings")}</dt>
          <dd className="mt-1 text-lg font-semibold">{format.number(result.summary.warningRowCount + result.summary.failedRowCount)}</dd>
        </div>
      </dl>

      {canDownloadResult(result) && (
        <MerchantNormalizationPanel result={result} normalization={normalization} onChange={updateNormalization} />
      )}
      <ConversionReview result={result} merchants={merchants} />
      {canDownloadResult(result) && <ConversionNextSteps />}

      <div className="flex justify-start">
        <Link href="/" onClick={onReset} className={buttonVariants()}>
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}

ConversionWorkspace.displayName = "ConversionWorkspace";
