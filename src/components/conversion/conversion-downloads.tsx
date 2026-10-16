"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ExcelDownload } from "@/components/conversion/excel-download";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  buildTextExportFiles,
  canDownloadResult,
  downloadExportFiles,
  type ExportFile,
  type ExportFormat,
  type ExportLabels,
} from "@/lib/conversion-export";
import type { ParseResponse } from "@/lib/conversion-types";
import { getParseErrorKey, getParseIssueKey } from "@/lib/parse-issues";

type ConversionDownloadsProps = { filename: string; result: ParseResponse };
type SpreadsheetExport = typeof import("@/lib/conversion-spreadsheet-export");

const formats: ExportFormat[] = ["csv", "json", "markdown", "tsv", "html"];

export function ConversionDownloads({ filename, result }: ConversionDownloadsProps) {
  const t = useTranslations("ConversionResult");
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const [tableDownloads, setTableDownloads] = useState<{ format: ExportFormat; files: ExportFile[] } | null>(null);
  const canDownload = canDownloadResult(result);
  const riskRowCount = result.summary.warningRowCount + result.summary.failedRowCount;
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetExport | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!canDownload) {
      return;
    }
    let current = true;
    void import("@/lib/conversion-spreadsheet-export").then(
      (module) => {
        if (current) {
          setSpreadsheet(module);
        }
      },
      () => {
        if (current) {
          setLoadFailed(true);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [canDownload, retry]);

  const labels = {
    locale,
    defaultFilename: t("excel.defaultFilename"),
    headers: [t("table.status"), t("table.warnings"), t("table.sourcePage"), t("table.sourceRow")],
    pageRisks: t("pageRisks.title"),
    tableWarnings: t("export.tableWarnings"),
    tableTitle: (index: number) => t("excel.sheetName", { index }),
    issue: (issue) => t(getParseIssueKey(issue), issue.params),
    error: (error) => t(getParseErrorKey(error.code), { page: error.page ?? "?" }),
  } satisfies ExportLabels;

  function downloadExcel(): void {
    if (!canDownload || !spreadsheet) {
      return;
    }
    setFailed(false);
    try {
      spreadsheet.downloadExcelWorkbook(filename, result, labels);
    } catch {
      setFailed(true);
    }
  }

  function download(format: ExportFormat): void {
    if (!canDownload) {
      return;
    }
    setFailed(false);
    try {
      const files =
        format === "csv" || format === "tsv"
          ? spreadsheet?.buildDelimitedExportFiles(format, filename, result, labels)
          : buildTextExportFiles(format, filename, result, labels);
      if (!files) {
        return;
      }
      setTableDownloads(files.length > 1 ? { format, files } : null);
      downloadExportFiles(files);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:items-end">
      {riskRowCount > 0 && (
        <div className="flex max-w-sm flex-col gap-1 sm:items-end">
          <Badge variant="secondary">
            <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
            {t("review.riskRowCount", { count: riskRowCount })}
          </Badge>
          <p className="text-xs text-muted-foreground sm:text-right">{t("review.exportAllRows")}</p>
        </div>
      )}
      <div className="flex w-fit">
        <ExcelDownload disabled={!canDownload || !spreadsheet} onDownload={downloadExcel} className="rounded-e-none" />
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!canDownload}
            render={<Button type="button" size="icon-lg" className="rounded-s-none" aria-label={t("export.moreFormats")} />}
          >
            <ChevronDownIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {formats.map((format) => (
                <DropdownMenuItem
                  key={format}
                  disabled={(format === "csv" || format === "tsv") && !spreadsheet}
                  onClick={() => download(format)}
                >
                  {t(`export.formats.${format}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {canDownload && !spreadsheet && (
        <div className="grid max-w-sm gap-2">
          <p role={loadFailed ? "alert" : "status"} className="text-sm text-muted-foreground">
            {t(loadFailed ? "export.loadFailed" : "export.loading")}
          </p>
          {loadFailed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoadFailed(false);
                setRetry((value) => value + 1);
              }}
            >
              {t("export.retry")}
            </Button>
          )}
        </div>
      )}
      {canDownload && tableDownloads && (
        <div className="flex max-w-sm flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("export.multipleFiles")}</p>
          <div className="flex flex-wrap gap-2">
            {tableDownloads.files.map((file, index) => (
              <Button
                key={file.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFailed(false);
                  try {
                    downloadExportFiles([file]);
                  } catch {
                    setFailed(true);
                  }
                }}
              >
                {t("export.downloadTable", { index: index + 1, format: t(`export.formats.${tableDownloads.format}`) })}
              </Button>
            ))}
          </div>
        </div>
      )}
      {failed && (
        <Alert variant="destructive" className="max-w-sm">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{t("export.failed")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

ConversionDownloads.displayName = "ConversionDownloads";
