import type { ExportLabels, MerchantExport } from "@/lib/conversion-export";
import type { ParseResponse } from "@/lib/conversion-types";

export const labels: ExportLabels = {
  locale: "en",
  defaultFilename: "statement",
  headers: ["Status", "Warnings", "Source page", "Source row"],
  pageRisks: "Page risks",
  tableWarnings: "Table notes",
  tableTitle: (index) => `Table ${index}`,
  unnamedColumn: (index) => `Column ${index}`,
  issue: (issue) => String(issue.params.message ?? issue.code),
  error: (error) => error.code,
};

// Only harmless formulas: no external requests or command execution.
export const formulaTexts = [
  "=1+1",
  "+1+1",
  "-1+1",
  "@SUM(1,1)",
  " =1+1",
  "\t=1+1",
  "\r=1+1",
  "\n=1+1",
  "\r\n=1+1",
  "\u0000=1+1",
  "\u001f=1+1",
  "\u007f=1+1",
  "\u0085=1+1",
  "\u00a0=1+1",
  "\u200b=1+1",
  "\u200e=1+1",
  "\u202e=1+1",
  "\u2060=1+1",
  "\ufeff=1+1",
  " \t\u0000\u200b+1+1",
  "＝1+1",
  "＋1+1",
  "－1+1",
  "＠SUM(1,1)",
  "\u3000＝1+1",
  "-1e2+1",
  "-10.00\n",
  "-10.00\n=1+1",
  '=1+1,\t"quoted"\nnext line',
];

export const unchangedTexts = [
  "-10.00",
  "(10.00)",
  "+10.00",
  "-.50",
  "-0",
  "10.00",
  "中文商户 café 日本語",
  "with,comma",
  "with\ttab",
  'with "quotes"',
  "two\nlines",
  "two\r\nlines",
  'ordinary,\t"quoted"\ntext',
  '\",=1+1',
  "prefix =1+1",
  "'=1+1",
  "",
];

export function createExportFixture(descriptions = ["=1+1"]): { result: ParseResponse; merchants: MerchantExport } {
  return {
    result: {
      schemaVersion: "1",
      filename: "statement.pdf",
      pageCount: 2,
      tables: [
        {
          id: "table-1",
          pageStart: 1,
          pageEnd: 2,
          columns: [
            { key: "date", label: "Date", index: 0 },
            { key: "description", label: "=1+1", index: 1 },
            { key: "amount", label: "Amount", index: 2 },
          ],
          rows: descriptions.map((description, index) => ({
            values: { date: "2026-10-01", description, amount: "-10.00" },
            source: { page: 2, row: index + 3 },
            status: "valid",
            warnings: [],
          })),
          warnings: [],
        },
      ],
      summary: {
        status: "success",
        tableCount: 1,
        rowCount: descriptions.length,
        validRowCount: descriptions.length,
        warningRowCount: 0,
        failedRowCount: 0,
      },
      errors: [],
    },
    merchants: {
      normalization: { "table-1": { columnKey: "description", aliases: Object.fromEntries(descriptions.map((value) => [value, value])) } },
      headers: ["Merchant", "Merchant status"],
      confirmed: "Confirmed",
      unassigned: "Unassigned",
    },
  };
}
