"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { getRowRiskCode, type ParseResponse } from "@/lib/conversion-types";
import { getParseIssueKey } from "@/lib/parse-issues";

type ExcelDownloadProps = {
  filename: string;
  result: ParseResponse;
};

function getDownloadName(filename: string): string {
  const baseName = filename.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "_").trim();
  return `${baseName || "bank-statement"}.xlsx`;
}

export function ExcelDownload({ filename, result }: ExcelDownloadProps) {
  const t = useTranslations("ConversionResult");
  const canDownload = result.summary.status !== "failed" &&
    result.summary.validRowCount + result.summary.warningRowCount > 0;

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
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      worksheet["!cols"] = table.columns.map(() => ({ wch: 20 })).concat([
        { wch: 14 },
        { wch: 36 },
        { wch: 14 },
        { wch: 14 },
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, `table-${tableIndex + 1}`);
    });

    XLSX.writeFile(workbook, getDownloadName(filename));
  }

  return (
    <Button type="button" size="lg" onClick={downloadWorkbook} disabled={!canDownload}>
      <DownloadIcon data-icon="inline-start" />
      {t("download")}
    </Button>
  );
}

ExcelDownload.displayName = "ExcelDownload";
