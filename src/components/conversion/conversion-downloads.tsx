"use client";

import { useState } from "react";
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ExcelDownload } from "@/components/conversion/excel-download";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildTextExportFiles, canDownloadResult, downloadExportFiles, type ExportFile, type TextExportFormat } from "@/lib/conversion-export";
import type { ParseResponse } from "@/lib/conversion-types";
import { getParseErrorKey, getParseIssueKey } from "@/lib/parse-issues";

type ConversionDownloadsProps = { filename: string; result: ParseResponse };
const formats: TextExportFormat[] = ["csv", "json", "markdown", "tsv", "html"];

export function ConversionDownloads({ filename, result }: ConversionDownloadsProps) {
  const t = useTranslations("ConversionResult");
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const [tableDownloads, setTableDownloads] = useState<{ format: TextExportFormat; files: ExportFile[] } | null>(null);
  const canDownload = canDownloadResult(result);

  function download(format: TextExportFormat): void {
    if (!canDownload) return;
    setFailed(false);
    try {
      const files = buildTextExportFiles(format, filename, result, {
        locale,
        defaultFilename: t("excel.defaultFilename"),
        headers: [t("table.status"), t("table.warnings"), t("table.sourcePage"), t("table.sourceRow")],
        pageRisks: t("pageRisks.title"),
        tableWarnings: t("export.tableWarnings"),
        tableTitle: (index) => t("excel.sheetName", { index }),
        issue: (issue) => t(getParseIssueKey(issue), issue.params),
        error: (error) => t(getParseErrorKey(error.code), { page: error.page ?? "?" }),
      });
      setTableDownloads(files.length > 1 ? { format, files } : null);
      downloadExportFiles(files);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:items-end">
      <div className="flex w-fit">
        <ExcelDownload filename={filename} result={result} className="rounded-e-none" onStart={() => setFailed(false)} onError={() => setFailed(true)} />
        <DropdownMenu>
          <DropdownMenuTrigger disabled={!canDownload} render={<Button type="button" size="icon-lg" className="rounded-s-none" aria-label={t("export.moreFormats")} />}>
            <ChevronDownIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {formats.map((format) => (
                <DropdownMenuItem key={format} onClick={() => download(format)}>
                  {t(`export.formats.${format}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
