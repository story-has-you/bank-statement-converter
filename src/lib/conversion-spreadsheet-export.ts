import * as XLSX from "@e965/xlsx";

import { canDownloadResult, getExportFilename, getTableRows, type ExportLabels, type ExportFile } from "@/lib/conversion-export";
import type { ParseResponse } from "@/lib/conversion-types";

/** Loaded only after a usable final result is available. */
export function buildDelimitedExportFiles(
  format: "csv" | "tsv",
  filename: string,
  result: ParseResponse,
  labels: ExportLabels,
): ExportFile[] {
  if (!canDownloadResult(result)) {
    return [];
  }
  const pageRisks = result.errors.map(labels.error).join("; ");
  return result.tables.map((table, index) => {
    const tableWarnings = table.warnings.map(labels.issue).join("; ");
    const headers = [...table.columns.map((column) => column.label), ...labels.headers, labels.pageRisks, labels.tableWarnings];
    const rows = getTableRows(table, labels.issue).map((row) => [...row, pageRisks, tableWarnings]);
    // An empty logical table can still carry risks; retain them in a metadata-only row.
    if (rows.length === 0 && (pageRisks || tableWarnings)) {
      rows.push([...headers.slice(0, -2).map(() => ""), pageRisks, tableWarnings]);
    }
    const content = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([headers, ...rows]), {
      FS: format === "csv" ? "," : "\t",
      RS: "\r\n",
      forceQuotes: true,
    });
    return {
      name: getExportFilename(filename, labels.defaultFilename, format, result.tables.length > 1 ? index : undefined),
      content: `\uFEFF${content}`,
      mimeType: format === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8",
    };
  });
}

export function buildExcelWorkbook(result: ParseResponse, labels: ExportLabels): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  result.tables.forEach((table, index) => {
    const headers = [...table.columns.map((column) => column.label), ...labels.headers];
    const riskRows = [...(index === 0 ? result.errors.map(labels.error) : []), ...table.warnings.map(labels.issue)].map((message) => [
      message,
      ...Array.from({ length: 9 }, () => ""),
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([...riskRows, headers, ...getTableRows(table, labels.issue)]);
    worksheet["!cols"] = table.columns.map(() => ({ wch: 20 })).concat([{ wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 14 }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, labels.tableTitle(index + 1));
  });
  return workbook;
}

export function downloadExcelWorkbook(filename: string, result: ParseResponse, labels: ExportLabels): void {
  if (!canDownloadResult(result)) {
    return;
  }
  XLSX.writeFile(buildExcelWorkbook(result, labels), getExportFilename(filename, labels.defaultFilename, "xlsx"));
}
