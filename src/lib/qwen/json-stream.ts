import "server-only";

import { JSONParser } from "@streamparser/json";

import { ConversionError } from "@/lib/conversion-errors";
import { isPreviewTable, type EmitConversionEvent } from "@/lib/conversion-events";
import { isParseResponse, type ParsedRow, type ParsedTable, type ParseResponse } from "@/lib/conversion-types";
import { MAX_RESPONSE_BYTES, requireUsableResult } from "@/lib/conversion/parser";
import { validateRowEvidence } from "./row-validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The parser emits closed values only. A row may arrive before its table metadata.
export class QwenJsonStream {
  private readonly parser = new JSONParser();
  private readonly completedPaths = new Set<string>();
  private readonly pendingRows = new Map<number, Map<number, unknown>>();
  private readonly tables = new Map<number, ParsedTable>();
  private readonly sentRows = new Map<number, number>();
  private size = 0;
  private result: unknown;

  constructor(private readonly emit: EmitConversionEvent) {
    this.parser.onValue = ({ value, key, parent, stack }) => {
      const path = JSON.stringify([...stack.map((entry) => entry.key), key]);
      if (this.completedPaths.has(path)) {
        throw new ConversionError("INVALID_QWEN_RESPONSE");
      }
      this.completedPaths.add(path);
      if (stack.length === 0) {
        this.result = value;
        return;
      }
      if (stack[1]?.key !== "tables" || typeof stack[2]?.key !== "number") {
        return;
      }
      const tableIndex = stack[2].key;
      if (stack.length === 4 && stack[3].key === "rows" && typeof key === "number") {
        const rows = this.pendingRows.get(tableIndex) ?? new Map<number, unknown>();
        rows.set(key, value);
        this.pendingRows.set(tableIndex, rows);
        this.flushRows(tableIndex);
      }
      if (stack.length === 3 && isRecord(parent)) {
        // The columns array must be closed before exposing it to the browser.
        const columnsPath = JSON.stringify([undefined, "tables", tableIndex, "columns"]);
        if (!this.completedPaths.has(columnsPath)) {
          return;
        }
        const candidate = {
          id: parent.id,
          pageStart: parent.pageStart,
          pageEnd: parent.pageEnd,
          columns: parent.columns,
          warnings: parent.warnings === undefined ? [] : parent.warnings,
          rows: [],
        };
        if (!isPreviewTable(candidate) || candidate.columns.length === 0) {
          return;
        }
        const previous = this.tables.get(tableIndex);
        if (previous && JSON.stringify(previous.columns) !== JSON.stringify(candidate.columns)) {
          throw new ConversionError("INVALID_QWEN_RESPONSE");
        }
        if (!previous || JSON.stringify(previous) !== JSON.stringify(candidate)) {
          this.tables.set(tableIndex, candidate);
          const { id, pageStart, pageEnd, columns, warnings } = candidate;
          const table = { id, pageStart, pageEnd, columns, warnings };
          this.emit({ type: "table", data: { tableIndex, table } });
        }
        this.flushRows(tableIndex);
      }
    };
  }

  write(content: string): void {
    this.size += Buffer.byteLength(content, "utf8");
    if (this.size > MAX_RESPONSE_BYTES) {
      throw new ConversionError("QWEN_RESPONSE_TOO_LARGE");
    }
    try {
      this.parser.write(content);
    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ConversionError("INVALID_QWEN_RESPONSE", 502, undefined, "invalid_json");
    }
  }

  finish(filename: string, pageCount: number): ParseResponse {
    try {
      if (!this.parser.isEnded) {
        this.parser.end();
      }
    } catch {
      throw new ConversionError("QWEN_INCOMPLETE_RESPONSE", 502, undefined, "incomplete_json");
    }
    if (!isRecord(this.result) || !Array.isArray(this.result.tables)) {
      throw new ConversionError("INVALID_QWEN_RESPONSE", 502, undefined, "invalid_document");
    }
    // Match Python's defaults for absent optional risk arrays. Explicitly invalid
    // values still go through contract validation instead of being discarded.
    const tables: unknown[] = this.result.tables.map((table) =>
      isRecord(table) && table.warnings === undefined ? { ...table, warnings: [] } : table,
    );
    const errors = this.result.errors === undefined ? [] : this.result.errors;
    let rowCount = 0;
    let validRowCount = 0;
    let warningRowCount = 0;
    let failedRowCount = 0;
    for (const table of tables) {
      if (!isRecord(table) || !Array.isArray(table.rows)) {
        continue;
      }
      rowCount += table.rows.length;
      for (const row of table.rows) {
        if (!isRecord(row)) {
          continue;
        }
        if (row.status === "valid") {
          validRowCount += 1;
        } else if (row.status === "warning") {
          warningRowCount += 1;
        } else if (row.status === "failed") {
          failedRowCount += 1;
        }
      }
    }
    const hasErrors = Array.isArray(errors) && errors.length > 0;
    const hasTableWarnings = tables.some((table) => isRecord(table) && Array.isArray(table.warnings) && table.warnings.length > 0);
    let status: ParseResponse["summary"]["status"] = "success";
    if (validRowCount + warningRowCount === 0) {
      status = "failed";
    } else if (warningRowCount + failedRowCount > 0 || hasErrors || hasTableWarnings) {
      status = "partial";
    }
    const result = {
      ...this.result,
      schemaVersion: "1",
      filename,
      pageCount,
      tables,
      errors,
      summary: { status, tableCount: tables.length, rowCount, validRowCount, warningRowCount, failedRowCount },
    };
    if (!isParseResponse(result) || result.tables.some((table) => table.columns.length === 0)) {
      throw new ConversionError("INVALID_QWEN_RESPONSE", 502, undefined, "final_result_contract");
    }
    result.tables.forEach((table, index) => {
      if ((this.sentRows.get(index) ?? 0) !== table.rows.length || !this.tables.has(index)) {
        throw new ConversionError("INVALID_QWEN_RESPONSE", 502, undefined, "preview_row_count");
      }
    });
    return requireUsableResult(result);
  }

  private flushRows(tableIndex: number): void {
    const table = this.tables.get(tableIndex);
    const pending = this.pendingRows.get(tableIndex);
    if (!table || !pending) {
      return;
    }
    const startIndex = this.sentRows.get(tableIndex) ?? 0;
    const rows: ParsedRow[] = [];
    while (pending.has(startIndex + rows.length)) {
      const candidate = { ...table, rows: [pending.get(startIndex + rows.length)] };
      if (!isPreviewTable(candidate)) {
        throw new ConversionError("INVALID_QWEN_RESPONSE");
      }
      const row = candidate.rows[0];
      const evidenceIssues = validateRowEvidence(table.columns, row.values);
      if (evidenceIssues.length > 0) {
        // The final document retains this row object, so SSE and summary agree.
        row.status = "failed";
        row.warnings.push(...evidenceIssues.filter((issue) => !row.warnings.some((warning) => warning.code === issue.code)));
      }
      rows.push(row);
      pending.delete(startIndex + rows.length - 1);
    }
    if (rows.length === 0) {
      return;
    }
    this.emit({ type: "rows", data: { tableIndex, startIndex, rows } });
    this.sentRows.set(tableIndex, startIndex + rows.length);
  }
}
