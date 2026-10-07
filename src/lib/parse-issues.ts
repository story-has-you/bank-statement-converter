import type { ParseIssue } from "@/lib/conversion-types";

export type ParseIssueTranslationKey = "issues.repeatedHeader" | "issues.summaryRow" | "issues.extraCells" | "issues.missingDate" | "issues.missingDescription" | "issues.missingAmount" | "issues.unknown";

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
    case "MISSING_DESCRIPTION":
      return "issues.missingDescription";
    case "MISSING_AMOUNT":
      return "issues.missingAmount";
    default:
      return "issues.unknown";
  }
}

