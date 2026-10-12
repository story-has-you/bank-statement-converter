import { conversionLimits } from "@/config/conversion";

import { isParseResponse, type ParsedTable, type ParseResponse } from "@/lib/conversion-types";
import type { ConversionErrorPayload } from "@/lib/conversion-errors";

export type TableMetadata = Omit<ParsedTable, "rows">;
export type ConversionStage = "reading" | "extracting" | "finalizing";
export type ConversionEvent =
  | { type: "status"; data: { stage: ConversionStage } }
  | { type: "table"; data: { tableIndex: number; table: TableMetadata } }
  | { type: "rows"; data: { tableIndex: number; startIndex: number; rows: ParsedTable["rows"] } }
  | { type: "complete"; data: Omit<ParseResponse, "tables"> }
  | { type: "error"; data: ConversionErrorPayload };

export type EmitConversionEvent = (event: ConversionEvent) => void;

export function emitParsedTables(result: ParseResponse, emit: EmitConversionEvent): void {
  result.tables.forEach(({ rows, ...table }, tableIndex) => {
    emit({ type: "table", data: { tableIndex, table } });
    for (let startIndex = 0; startIndex < rows.length; startIndex += 50) {
      emit({ type: "rows", data: { tableIndex, startIndex, rows: rows.slice(startIndex, startIndex + 50) } });
    }
  });
}

// Validate preview fragments through the same contract as completed conversions.
export function isPreviewTable(value: unknown): value is ParsedTable {
  return isParseResponse({ schemaVersion: "1", filename: "", pageCount: conversionLimits.pages, tables: [value], errors: [], summary: getPreviewSummary(value) });
}

function getPreviewSummary(value: unknown): ParseResponse["summary"] {
  const rows: unknown[] = typeof value === "object" && value !== null && "rows" in value && Array.isArray(value.rows) ? value.rows : [];
  let validRowCount = 0;
  let warningRowCount = 0;
  let failedRowCount = 0;
  for (const row of rows) {
    if (typeof row !== "object" || row === null || !("status" in row)) continue;
    if (row.status === "valid") validRowCount += 1;
    else if (row.status === "warning") warningRowCount += 1;
    else if (row.status === "failed") failedRowCount += 1;
  }
  return { status: "partial", tableCount: 1, rowCount: rows.length, validRowCount, warningRowCount, failedRowCount };
}
