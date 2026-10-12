import type { ParseIssue } from "@/lib/conversion-types";

export type ParseIssueTranslationKey =
  | "issues.repeatedHeader"
  | "issues.summaryRow"
  | "issues.extraCells"
  | "issues.missingDate"
  | "issues.invalidDate"
  | "issues.missingDescription"
  | "issues.missingAmount"
  | "issues.invalidAmount"
  | "issues.amountColumnMismatch"
  | "issues.unknown";

export function getParseIssueKey(issue: ParseIssue): ParseIssueTranslationKey {
  switch (issue.code) {
    case "REPEATED_HEADER":
      return "issues.repeatedHeader";
    case "SUMMARY_ROW":
      return "issues.summaryRow";
    case "EXTRA_CELLS":
      return "issues.extraCells";
    case "MISSING_DATE":
      return "issues.missingDate";
    case "INVALID_DATE":
      return "issues.invalidDate";
    case "MISSING_DESCRIPTION":
      return "issues.missingDescription";
    case "MISSING_AMOUNT":
      return "issues.missingAmount";
    case "INVALID_AMOUNT":
      return "issues.invalidAmount";
    case "AMOUNT_COLUMN_MISMATCH":
      return "issues.amountColumnMismatch";
    default:
      return "issues.unknown";
  }
}

export type ParseErrorTranslationKey = "pageRisks.pageParseFailed" | "pageRisks.pageUnparsed" | "pageRisks.unknown";

export function getParseErrorKey(code: string): ParseErrorTranslationKey {
  if (code === "PAGE_PARSE_FAILED") return "pageRisks.pageParseFailed";
  if (code === "PAGE_UNPARSED") return "pageRisks.pageUnparsed";
  return "pageRisks.unknown";
}
