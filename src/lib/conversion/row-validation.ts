import type { ParseColumn, ParseIssue, ParsedRow } from "@/lib/conversion-types";

export const DATE_HEADERS = ["date", "time", "datum", "wertstellung", "日期", "时间"];
export const DESCRIPTION_HEADERS = [
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
  "check number",
  "cheque number",
  "reference number",
  "security name",
  "payee",
];
export const AMOUNT_HEADERS = [
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
  "paid out",
  "paid in",
  "money out",
  "money in",
  "transaction total",
];
export const BALANCE_HEADERS = ["balance", "saldo", "余额"];
const DATE_SHAPE = /^(?:\d{8}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)(?:\s|$)/;
const AMOUNT_SHAPE =
  /^(?:(?:[A-Z]{3}|[€$£¥])\s*)?[+−-]?(?:(?:\d{1,3}(?:[ ,.]\d{3})+|\d+)(?:[,.]\d{1,2})?|[,.]\d{1,2})(?:\s*(?:[A-Z]{3}|[€$£¥]))?$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function hasDateShape(value: string): boolean {
  return (
    DATE_SHAPE.test(value) || /^(?:\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?|[A-Za-z]{3,9}\s+\d{1,2}(?:,?\s+\d{2,4})?)(?:\s|$)/.test(value)
  );
}
export function isDateHeader(label: string): boolean {
  return DATE_HEADERS.some((term) => label.toLowerCase().includes(term));
}
export function isBalanceHeader(label: string): boolean {
  return BALANCE_HEADERS.some((term) => label.toLowerCase().includes(term));
}
export function isAmountHeader(label: string): boolean {
  if (/^(?:in|out)$/i.test(label.trim())) {
    return true;
  }
  return !isBalanceHeader(label) && AMOUNT_HEADERS.some((term) => label.toLowerCase().replace(/\s+/g, " ").includes(term));
}
export function isDescriptionHeader(label: string): boolean {
  return (
    !isDateHeader(label) &&
    !isAmountHeader(label) &&
    (/^(?:number|check num\.?)$/i.test(label.trim()) || DESCRIPTION_HEADERS.some((term) => label.toLowerCase().includes(term)))
  );
}

export function matchesHeader(column: ParseColumn, terms: readonly string[]): boolean {
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

export function isValidDate(value: string): boolean {
  value = value.trim().replace(/\s*([-/.])\s*/g, "$1");
  const named = value.match(/^(?:(\d{1,2})\s+([A-Za-z]{3,9})|([A-Za-z]{3,9})\s+(\d{1,2}))(?:,?\s+(\d{2,4}))?(?:\s|$)/);
  if (named) {
    const month = MONTHS.indexOf((named[2] ?? named[3]).slice(0, 3).toLowerCase()) + 1;
    let year = named[5] ? Number(named[5]) : 2000;
    if (year < 100) {
      year += 2000;
    }
    return isCalendarDate(year, month, Number(named[1] ?? named[4]));
  }
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

export function isValidAmount(value: string): boolean {
  if (value.startsWith("(") !== value.endsWith(")")) {
    return false;
  }
  let amount = value.startsWith("(") ? value.slice(1, -1).trim() : value;
  if (/[\d][ ]*[-−]$/.test(amount)) {
    amount = "-" + amount.replace(/[ ]*[-−]$/, "");
  }
  amount = amount.replace(/^([+−-])\s*([€$£¥]|[A-Z]{3})\s*/, "$2$1");
  return AMOUNT_SHAPE.test(amount);
}

export function validateRowEvidence(columns: ParseColumn[], values: ParsedRow["values"]): ParseIssue[] {
  const dateColumns = columns.filter((column) => matchesHeader(column, DATE_HEADERS));
  const balanceColumns = columns.filter((column) => matchesHeader(column, BALANCE_HEADERS));
  const amountColumns = columns.filter((column) => isAmountHeader(column.label));
  const descriptionColumns = columns.filter(
    (column) => isDescriptionHeader(column.label) && !dateColumns.includes(column) && !amountColumns.includes(column),
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
