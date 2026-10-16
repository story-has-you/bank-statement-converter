import * as XLSX from "@e965/xlsx";

import {
  canDownloadResult,
  getExportFilename,
  getTableHeaders,
  getTableRows,
  type ExportLabels,
  type ExportFile,
  type MerchantExport,
} from "@/lib/conversion-export";
import type { ParseResponse } from "@/lib/conversion-types";

/** Loaded only after a usable final result is available. */
export function buildDelimitedExportFiles(
  format: "csv" | "tsv",
  filename: string,
  result: ParseResponse,
  labels: ExportLabels,
  merchants?: MerchantExport,
): ExportFile[] {
  if (!canDownloadResult(result)) {
    return [];
  }
  const pageRisks = result.errors.map(labels.error).join("; ");
  return result.tables.map((table, index) => {
    const tableWarnings = table.warnings.map(labels.issue).join("; ");
    const headers = [...getTableHeaders(table, labels, merchants), labels.pageRisks, labels.tableWarnings];
    const rows = getTableRows(table, labels.issue, merchants).map((row) => [...row, pageRisks, tableWarnings]);
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

export function buildExcelWorkbook(result: ParseResponse, labels: ExportLabels, merchants?: MerchantExport): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  result.tables.forEach((table, index) => {
    const headers = getTableHeaders(table, labels, merchants);
    const riskRows = [...(index === 0 ? result.errors.map(labels.error) : []), ...table.warnings.map(labels.issue)].map((message) => [
      message,
      ...headers.slice(1).map(() => ""),
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([...riskRows, headers, ...getTableRows(table, labels.issue, merchants)]);
    worksheet["!cols"] = table.columns
      .map(() => ({ wch: 20 }))
      .concat(merchants ? [{ wch: 24 }, { wch: 24 }] : [], [{ wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 14 }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, labels.tableTitle(index + 1));
  });
  return workbook;
}

export function downloadExcelWorkbook(filename: string, result: ParseResponse, labels: ExportLabels, merchants?: MerchantExport): void {
  if (!canDownloadResult(result)) {
    return;
  }
  XLSX.writeFile(buildExcelWorkbook(result, labels, merchants), getExportFilename(filename, labels.defaultFilename, "xlsx"));
}
