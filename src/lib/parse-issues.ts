import type { ParseIssue } from "@/lib/conversion-types";

export type ParseIssueTranslationKey = "issues.repeatedHeader" | "issues.summaryRow" | "issues.extraCells" | "issues.unknown";

export function getParseIssueKey(issue: ParseIssue): ParseIssueTranslationKey {
  switch (issue.code) {
    case "REPEATED_HEADER":
      return "issues.repeatedHeader";
    case "SUMMARY_ROW":
      return "issues.summaryRow";
    case "EXTRA_CELLS":
      return "issues.extraCells";
    default:
      return "issues.unknown";
  }
}
