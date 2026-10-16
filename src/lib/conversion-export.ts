import { getRowRiskCode, type ParseIssue, type ParsedTable, type ParseResponse } from "@/lib/conversion-types";
import { getMerchantName, type MerchantNormalization } from "@/lib/merchant-normalization";

export type TextExportFormat = "json" | "markdown" | "html";
export type ExportFormat = TextExportFormat | "csv" | "tsv";

export type ExportLabels = {
  locale: string;
  defaultFilename: string;
  headers: [string, string, string, string];
  pageRisks: string;
  tableWarnings: string;
  tableTitle: (index: number) => string;
  issue: (issue: ParseIssue) => string;
  error: (error: ParseResponse["errors"][number]) => string;
};

export type ExportFile = { name: string; content: string; mimeType: string };
export type MerchantExport = {
  normalization: MerchantNormalization;
  headers: [string, string];
  confirmed: string;
  unassigned: string;
};
type ExportCell = string | number;

export function canDownloadResult(result: ParseResponse): boolean {
  return result.summary.status !== "failed" && result.summary.validRowCount + result.summary.warningRowCount > 0;
}

export function getExportFilename(filename: string, defaultFilename: string, extension: string, tableIndex?: number): string {
  const baseName = filename
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
  const suffix = tableIndex === undefined ? "" : `-${tableIndex + 1}`;
  return `${baseName || defaultFilename}${suffix}.${extension}`;
}

export function getTableHeaders(table: ParsedTable, labels: ExportLabels, merchants?: MerchantExport): string[] {
  return [...table.columns.map((column) => column.label), ...(merchants?.headers ?? []), ...labels.headers];
}

export function getTableRows(table: ParsedTable, issue: ExportLabels["issue"], merchants?: MerchantExport): ExportCell[][] {
  return table.rows.map((row) => {
    const name = merchants ? getMerchantName(merchants.normalization, table.id, row) : null;
    const merchantCells = merchants ? [name ?? "", name === null ? merchants.unassigned : merchants.confirmed] : [];
    return [
      ...table.columns.map((column) => row.values[column.key] ?? ""),
      ...merchantCells,
      getRowRiskCode(row.status),
      row.warnings.map(issue).join("; "),
      row.source.page,
      row.source.row,
    ];
  });
}

function escapeHtml(value: ExportCell): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeMarkdown(value: ExportCell): string {
  return escapeHtml(String(value).replace(/[\\`*_[\]{}()#+.!|~\-]/g, "\\$&")).replace(/\r\n|\r|\n/g, "<br>");
}

function toMarkdown(filename: string, result: ParseResponse, labels: ExportLabels, merchants?: MerchantExport): string {
  const sections = [`# ${escapeMarkdown(filename)}`];
  if (result.errors.length > 0) {
    sections.push(
      `## ${escapeMarkdown(labels.pageRisks)}\n\n${result.errors.map((error) => `- ${escapeMarkdown(labels.error(error))}`).join("\n")}`,
    );
  }
  result.tables.forEach((table, index) => {
    sections.push(`## ${escapeMarkdown(labels.tableTitle(index + 1))}`);
    if (table.warnings.length > 0) {
      sections.push(
        `### ${escapeMarkdown(labels.tableWarnings)}\n\n${table.warnings.map((issue) => `- ${escapeMarkdown(labels.issue(issue))}`).join("\n")}`,
      );
    }
    const headers = getTableHeaders(table, labels, merchants);
    const lines = [headers, headers.map(() => "---"), ...getTableRows(table, labels.issue, merchants)];
    sections.push(
      lines
        .map((row, rowIndex) => `| ${row.map((cell) => (rowIndex === 1 ? String(cell) : escapeMarkdown(cell))).join(" | ")} |`)
        .join("\n"),
    );
  });
  return `${sections.join("\n\n")}\n`;
}

function toHtml(filename: string, result: ParseResponse, labels: ExportLabels, merchants?: MerchantExport): string {
  const sections = [`<h1>${escapeHtml(filename)}</h1>`];
  if (result.errors.length > 0) {
    sections.push(
      `<section><h2>${escapeHtml(labels.pageRisks)}</h2><ul>${result.errors.map((error) => `<li>${escapeHtml(labels.error(error))}</li>`).join("")}</ul></section>`,
    );
  }
  result.tables.forEach((table, index) => {
    const headers = getTableHeaders(table, labels, merchants);
    const warnings =
      table.warnings.length > 0
        ? `<h3>${escapeHtml(labels.tableWarnings)}</h3><ul>${table.warnings.map((issue) => `<li>${escapeHtml(labels.issue(issue))}</li>`).join("")}</ul>`
        : "";
    sections.push(`<section><h2>${escapeHtml(labels.tableTitle(index + 1))}</h2>${warnings}
<div class="table-wrapper"><table><thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
<tbody>${getTableRows(table, labels.issue, merchants)
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div></section>`);
  });
  return `<!doctype html>
<html lang="${escapeHtml(labels.locale)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(filename)}</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem}section{margin-block:2rem}.table-wrapper{overflow-x:auto}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.5rem;text-align:left;white-space:pre-wrap}th{background:#f4f4f4}h1,li{white-space:pre-wrap;overflow-wrap:anywhere}</style>
</head><body>${sections.join("\n")}</body></html>\n`;
}

/** Generates files from the current result without changing the parser contract or persisting data. */
export function buildTextExportFiles(
  format: TextExportFormat,
  filename: string,
  result: ParseResponse,
  labels: ExportLabels,
  merchants?: MerchantExport,
): ExportFile[] {
  if (!canDownloadResult(result)) {
    return [];
  }
  const extension = format === "markdown" ? "md" : format;
  let content: string;
  let mimeType: string;
  switch (format) {
    case "json": {
      let exportResult = result;
      if (merchants) {
        exportResult = {
          ...result,
          tables: result.tables.map((table) => ({
            ...table,
            rows: table.rows.map((row) => {
              const merchantName = getMerchantName(merchants.normalization, table.id, row);
              return { ...row, merchantName, merchantNormalizationStatus: merchantName === null ? "unassigned" : "confirmed" };
            }),
          })),
        };
      }
      content = `${JSON.stringify(exportResult, null, 2)}\n`;
      mimeType = "application/json;charset=utf-8";
      break;
    }
    case "markdown":
      content = toMarkdown(filename, result, labels, merchants);
      mimeType = "text/markdown;charset=utf-8";
      break;
    case "html":
      content = toHtml(filename, result, labels, merchants);
      mimeType = "text/html;charset=utf-8";
      break;
  }
  return [{ name: getExportFilename(filename, labels.defaultFilename, extension), content, mimeType }];
}

export function downloadExportFiles(files: ExportFile[]): void {
  for (const file of files) {
    const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
    const link = document.createElement("a");
    try {
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Give the browser time to start consuming the Blob before revoking its URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}
