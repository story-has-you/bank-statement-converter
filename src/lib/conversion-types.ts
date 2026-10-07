export type RowStatus = "valid" | "warning" | "failed";

export function getRowRiskCode(status: RowStatus): "OK" | "DISCREPANCY" | "UNVERIFIABLE" {
  if (status === "failed") return "UNVERIFIABLE";
  if (status === "warning") return "DISCREPANCY";
  return "OK";
}

export type SummaryStatus = "success" | "partial" | "failed";

export type ParseColumn = {
  key: string;
  label: string;
  index: number;
};

export type ParsedRow = {
  values: Record<string, string | null>;
  source: {
    page: number;
    row: number;
  };
  status: RowStatus;
  warnings: ParseIssue[];
};

export type ParseIssue = {
  code: string;
  params: Record<string, number | string>;
};

export type ParsedTable = {
  id: string;
  pageStart: number;
  pageEnd: number;
  columns: ParseColumn[];
  rows: ParsedRow[];
  warnings: ParseIssue[];
};

export type ParseResponse = {
  schemaVersion: string;
  filename: string;
  pageCount: number;
  tables: ParsedTable[];
  summary: {
    status: SummaryStatus;
    tableCount: number;
    rowCount: number;
    validRowCount: number;
    warningRowCount: number;
    failedRowCount: number;
  };
  errors: Array<{
    code: string;
    message: string;
    page: number | null;
  }>;
};

export type ConversionPayload = {
  version: 1;
  filename: string;
  result: ParseResponse;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  if (
    typeof value.schemaVersion !== "string" ||
    typeof value.pageCount !== "number" ||
    !Array.isArray(value.tables) ||
    !Array.isArray(value.errors) ||
    !isRecord(value.summary)
  ) {
    return false;
  }

  const summary = value.summary;
  if (
    !isSummaryStatus(summary.status) ||
    typeof summary.tableCount !== "number" ||
    typeof summary.rowCount !== "number" ||
    typeof summary.validRowCount !== "number" ||
    typeof summary.warningRowCount !== "number" ||
    typeof summary.failedRowCount !== "number"
  ) {
    return false;
  }

  return value.tables.every((table) => {
    if (
      !isRecord(table) ||
      typeof table.id !== "string" ||
      typeof table.pageStart !== "number" ||
      typeof table.pageEnd !== "number" ||
      !Array.isArray(table.columns) ||
      !Array.isArray(table.rows) ||
        !Array.isArray(table.warnings) ||
        !table.warnings.every(isParseIssue)
    ) {
      return false;
    }

    const columnsAreValid = table.columns.every(
      (column) =>
        isRecord(column) &&
        typeof column.key === "string" &&
        typeof column.label === "string" &&
        typeof column.index === "number",
    );
    const rowsAreValid = table.rows.every((row) => {
      if (
        !isRecord(row) ||
        !isRecord(row.values) ||
        !isRecord(row.source) ||
        !isRowStatus(row.status) ||
        !Array.isArray(row.warnings) ||
        !row.warnings.every(isParseIssue) ||
        typeof row.source.page !== "number" ||
        typeof row.source.row !== "number"
      ) {
        return false;
      }

      return Object.values(row.values).every(
        (cell) => typeof cell === "string" || cell === null,
      );
    });

    return columnsAreValid && rowsAreValid;
  });
}

function isParseIssue(value: unknown): value is ParseIssue {
  if (typeof value !== "object" || value === null || !("code" in value) || !("params" in value)) {
    return false;
  }

  return (
    typeof value.code === "string" &&
    typeof value.params === "object" &&
    value.params !== null &&
    Object.values(value.params).every((param) => typeof param === "string" || typeof param === "number")
  );
}
