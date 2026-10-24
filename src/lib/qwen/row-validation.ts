import type { ParseColumn, ParseIssue, ParsedRow } from "@/lib/conversion-types";

// Keep evidence rules aligned with services/parser/app/row_validation.py.
const DATE_HEADERS = ["date", "time", "datum", "wertstellung", "日期", "时间"];
const DESCRIPTION_HEADERS = [
  "description",
  "transaction",
  "buchung",
  "jahreskontoauszug",
  "摘要",
  "交易名称",
  "说明",
  "用途",
  "备注",
  "memo",
  "details",
];
const AMOUNT_HEADERS = [
  "amount",
  "debit",
  "credit",
  "withdrawal",
  "deposit",
  "betrag",
  "lastschrift",
  "gutschrift",
  "金额",
  "发生额",
  "借",
  "贷",
  "收入",
  "支出",
];
const BALANCE_HEADERS = ["balance", "saldo", "余额"];
const DATE_SHAPE = /^(?:\d{8}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)(?:\s|$)/;
const AMOUNT_SHAPE = /^(?:(?:[A-Z]{3}|[€$£¥])\s*)?[+-]?(?:\d{1,3}(?:[ ,.]\d{3})+|\d+)(?:[,.]\d{1,2})?(?:\s*(?:[A-Z]{3}|[€$£¥]))?$/;

function matchesHeader(column: ParseColumn, terms: string[]): boolean {
  const label = column.label.toLowerCase();
  return terms.some((term) => label.includes(term));
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function isValidDate(value: string): boolean {
  if (!DATE_SHAPE.test(value)) {
    return false;
  }
  const token = value.split(/\s/)[0];
  if (/^\d{8}$/.test(token)) {
    return isCalendarDate(Number(token.slice(0, 4)), Number(token.slice(4, 6)), Number(token.slice(6)));
  }
  const parts = token.split(/[-/.]/);
  const [first, second, third] = parts.map(Number);
  if (parts.length === 2) {
    return isCalendarDate(2000, first, second) || isCalendarDate(2000, second, first);
  }
  let year = parts[0].length === 4 ? first : third;
  if (year < 100) {
    year += 2000;
  }
  if (parts[0].length === 4) {
    return isCalendarDate(year, second, third);
  }
  return isCalendarDate(year, first, second) || isCalendarDate(year, second, first);
}

function isValidAmount(value: string): boolean {
  if (value.startsWith("(") !== value.endsWith(")")) {
    return false;
  }
  const amount = value.startsWith("(") ? value.slice(1, -1).trim() : value;
  return AMOUNT_SHAPE.test(amount);
}

export function validateRowEvidence(columns: ParseColumn[], values: ParsedRow["values"]): ParseIssue[] {
  const dateColumns = columns.filter((column) => matchesHeader(column, DATE_HEADERS));
  const balanceColumns = columns.filter((column) => matchesHeader(column, BALANCE_HEADERS));
  const amountColumns = columns.filter((column) => matchesHeader(column, AMOUNT_HEADERS) && !balanceColumns.includes(column));
  const descriptionColumns = columns.filter(
    (column) => matchesHeader(column, DESCRIPTION_HEADERS) && !dateColumns.includes(column) && !amountColumns.includes(column),
  );
  const cell = (column: ParseColumn): string => (values[column.key] ?? "").trim();
  const issues: ParseIssue[] = [];
  const dateValues = dateColumns.map(cell);
  if (!dateValues.some(isValidDate)) {
    issues.push({ code: dateValues.some(Boolean) ? "INVALID_DATE" : "MISSING_DATE", params: {} });
  }
  if (!descriptionColumns.some((column) => cell(column))) {
    issues.push({ code: "MISSING_DESCRIPTION", params: {} });
  }
  const amountValues = amountColumns.map(cell);
  if (!amountValues.some(isValidAmount)) {
    const otherAmount = columns.some(
      (column) =>
        !amountColumns.includes(column) && !balanceColumns.includes(column) && !dateColumns.includes(column) && isValidAmount(cell(column)),
    );
    let code = "MISSING_AMOUNT";
    if (otherAmount) {
      code = "AMOUNT_COLUMN_MISMATCH";
    } else if (amountValues.some(Boolean)) {
      code = "INVALID_AMOUNT";
    }
    issues.push({ code, params: {} });
  }
  return issues;
}
