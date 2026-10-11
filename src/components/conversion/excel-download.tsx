"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as XLSX from "@e965/xlsx";

import { Button } from "@/components/ui/button";
import { canDownloadResult, getExportFilename } from "@/lib/conversion-export";
import { getRowRiskCode, type ParseResponse } from "@/lib/conversion-types";
import { getParseErrorKey, getParseIssueKey } from "@/lib/parse-issues";

type ExcelDownloadProps = {
  filename: string;
  result: ParseResponse;
  className?: string;
  onStart?: () => void;
  onError?: () => void;
};

export function ExcelDownload({ filename, result, className, onStart, onError }: ExcelDownloadProps) {
  const t = useTranslations("ConversionResult");
  const canDownload = canDownloadResult(result);

  function downloadWorkbook() {
    if (!canDownload) return;

    const workbook = XLSX.utils.book_new();
    result.tables.forEach((table, tableIndex) => {
      const headers = [
        ...table.columns.map((column) => column.label),
        t("table.status"),
        t("table.warnings"),
        t("table.sourcePage"),
        t("table.sourceRow"),
      ];
      const rows = table.rows.map((row) => [
        ...table.columns.map((column) => row.values[column.key] ?? ""),
        getRowRiskCode(row.status),
        row.warnings.map((warning) => t(getParseIssueKey(warning), warning.params)).join("; "),
        row.source.page,
        row.source.row,
      ]);
      const sheetRows = tableIndex === 0
        ? [
            ...result.errors.map((error) => [
              t(getParseErrorKey(error.code), { page: error.page ?? "?" }),
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ]),
            ...table.warnings.map((warning) => [
              t(getParseIssueKey(warning), warning.params),
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ]),
            headers,
            ...rows,
          ]
        : [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
      worksheet["!cols"] = table.columns.map(() => ({ wch: 20 })).concat([
        { wch: 14 },
        { wch: 36 },
        { wch: 14 },
        { wch: 14 },
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, t("excel.sheetName", { index: tableIndex + 1 }));
    });

    XLSX.writeFile(workbook, getExportFilename(filename, t("excel.defaultFilename"), "xlsx"));
  }

  return (
    <Button type="button" size="lg" className={className} onClick={() => {
      onStart?.();
      try { downloadWorkbook(); }
      catch { onError?.(); }
    }} disabled={!canDownload}>
      <DownloadIcon data-icon="inline-start" />
      {t("download")}
    </Button>
  );
}

ExcelDownload.displayName = "ExcelDownload";
