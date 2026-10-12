export type RowStatus = "valid" | "warning" | "failed";

export function getRowRiskCode(status: RowStatus): "OK" | "DISCREPANCY" | "UNVERIFIABLE" {
  if (status === "failed") return "UNVERIFIABLE";
  if (status === "warning") return "DISCREPANCY";
  return "OK";
}

export type SummaryStatus = "success" | "partial" | "failed";

export type ParseColumn = { key: string; label: string; index: number };

export type ParsedRow = { values: Record<string, string | null>; source: { page: number; row: number }; status: RowStatus; warnings: ParseIssue[] };

export type ParseIssue = { code: string; params: Record<string, number | string> };

export type ParsedTable = { id: string; pageStart: number; pageEnd: number; columns: ParseColumn[]; rows: ParsedRow[]; warnings: ParseIssue[] };

export type ParseResponse = {
  schemaVersion: "1";
  filename: string;
  pageCount: number;
  tables: ParsedTable[];
  summary: { status: SummaryStatus; tableCount: number; rowCount: number; validRowCount: number; warningRowCount: number; failedRowCount: number };
  errors: Array<{ code: string; page: number | null }>;
};

export type ConversionPayload = { version: 1; filename: string; result: ParseResponse };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRowStatus(value: unknown): value is RowStatus {
  return value === "valid" || value === "warning" || value === "failed";
}

function isSummaryStatus(value: unknown): value is SummaryStatus {
  return value === "success" || value === "partial" || value === "failed";
}

export function isParseResponse(value: unknown): value is ParseResponse {
  if (!isRecord(value) || typeof value.filename !== "string") {
    return false;
  }

  if (value.schemaVersion !== "1" || !isNonNegativeInteger(value.pageCount) || !Array.isArray(value.tables) || !Array.isArray(value.errors) || !isRecord(value.summary)) {
    return false;
  }

  const pageCount = value.pageCount;
  const tables = value.tables;
  const errors = value.errors;
  const summary = value.summary;
  if (
    !isSummaryStatus(summary.status) ||
    !isNonNegativeInteger(summary.tableCount) ||
    !isNonNegativeInteger(summary.rowCount) ||
    !isNonNegativeInteger(summary.validRowCount) ||
    !isNonNegativeInteger(summary.warningRowCount) ||
    !isNonNegativeInteger(summary.failedRowCount) ||
    summary.tableCount !== tables.length
  ) {
    return false;
  }

  const errorsAreValid = errors.every((error) => isRecord(error) && typeof error.code === "string" && (error.page === null || (isPositiveInteger(error.page) && error.page <= pageCount)));
  if (!errorsAreValid) return false;

  let rowCount = 0;
  let validRowCount = 0;
  let warningRowCount = 0;
  let failedRowCount = 0;
  const tablesAreValid = tables.every((rawTable) => {
    if (!isRecord(rawTable)) return false;
    const table = rawTable;
    if (
      typeof table.id !== "string" ||
      !isPositiveInteger(table.pageStart) ||
      !isPositiveInteger(table.pageEnd) ||
      table.pageStart > table.pageEnd ||
      table.pageEnd > pageCount ||
      !Array.isArray(table.columns) ||
      !Array.isArray(table.rows) ||
      !Array.isArray(table.warnings) ||
      !table.warnings.every(isParseIssue)
    ) {
      return false;
    }

    const pageStart = table.pageStart;
    const pageEnd = table.pageEnd;
    const columns = table.columns;
    const rows = table.rows;

    const columnKeys = new Set<string>();
    const columnIndexes = new Set<number>();
    for (const column of columns) {
      if (
        !isRecord(column) ||
        typeof column.key !== "string" ||
        column.key.length === 0 ||
        typeof column.label !== "string" ||
        !isNonNegativeInteger(column.index) ||
        column.index >= columns.length ||
        columnKeys.has(column.key) ||
        columnIndexes.has(column.index)
      )
        return false;
      columnKeys.add(column.key);
      columnIndexes.add(column.index);
    }
    const requiredColumnKeys = [...columnKeys];
    const rowsAreValid = rows.every((rawRow) => {
      if (!isRecord(rawRow)) return false;
      const row = rawRow;
      if (
        !isRecord(row.values) ||
        !isRecord(row.source) ||
        !isRowStatus(row.status) ||
        !Array.isArray(row.warnings) ||
        !row.warnings.every(isParseIssue) ||
        !isPositiveInteger(row.source.page) ||
        row.source.page > pageCount ||
        !isPositiveInteger(row.source.row) ||
        row.source.page < pageStart ||
        row.source.page > pageEnd
      ) {
        return false;
      }

      const values = row.values;
      const valuesAreValid = Object.values(values).every((cell) => typeof cell === "string" || cell === null);
      const valuesMatchColumns = requiredColumnKeys.every((key) => Object.hasOwn(values, key));
      if (!valuesAreValid || !valuesMatchColumns) return false;
      rowCount += 1;
      if (row.status === "valid") validRowCount += 1;
      if (row.status === "warning") warningRowCount += 1;
      if (row.status === "failed") failedRowCount += 1;
      return true;
    });

    return rowsAreValid;
  });

  return tablesAreValid && rowCount === summary.rowCount && validRowCount === summary.validRowCount && warningRowCount === summary.warningRowCount && failedRowCount === summary.failedRowCount;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isParseIssue(value: unknown): value is ParseIssue {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    isRecord(value.params) &&
    Object.values(value.params).every((param) => typeof param === "string" || (typeof param === "number" && Number.isFinite(param)))
  );
}
