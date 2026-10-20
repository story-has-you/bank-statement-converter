"use client";

import { useState, type ReactNode } from "react";
import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONVERSION_VISIBLE_ROW_LIMIT } from "@/config/conversion";
import type { MerchantExport } from "@/lib/conversion-export";
import { getColumnLabel, getRowRiskCode, type ParsedTable, type RowStatus } from "@/lib/conversion-types";
import { getMerchantName } from "@/lib/merchant-normalization";
import { getParseIssueKey } from "@/lib/parse-issues";
import { cn } from "@/lib/utils";

type ConversionTableProps = {
  table: ParsedTable;
  title?: string;
  onlyRiskRows?: boolean;
  riskFilter?: ReactNode;
  merchants?: MerchantExport;
  previewRowLimit?: number;
};

function statusVariant(status: RowStatus): "default" | "secondary" | "outline" {
  if (status === "failed") {
    return "outline";
  }
  if (status === "warning") {
    return "secondary";
  }
  return "default";
}

function columnWidthClass(index: number): string {
  if (index === 0) {
    return "min-w-40";
  }
  if (index === 1 || index === 10 || index === 11) {
    return "min-w-56";
  }
  if (index === 6) {
    return "min-w-44";
  }
  if (index === 8 || index === 9) {
    return "min-w-32";
  }
  if (index === 12) {
    return "min-w-40";
  }
  return "min-w-28";
}

export function ConversionTable({ table, title, onlyRiskRows = false, riskFilter, merchants, previewRowLimit }: ConversionTableProps) {
  const t = useTranslations("ConversionResult");
  const [pagination, setPagination] = useState({ onlyRiskRows, page: 1 });
  if (pagination.onlyRiskRows !== onlyRiskRows) {
    setPagination({ onlyRiskRows, page: 1 });
  }
  const filteredRows = onlyRiskRows ? table.rows.filter((row) => row.status !== "valid") : table.rows;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / CONVERSION_VISIBLE_ROW_LIMIT));
  const currentPage = Math.min(pagination.page, pageCount);
  const start = previewRowLimit === undefined ? (currentPage - 1) * CONVERSION_VISIBLE_ROW_LIMIT : 0;
  const visibleRows = filteredRows.slice(start, start + (previewRowLimit ?? CONVERSION_VISIBLE_ROW_LIMIT));
  const tableTitle = title ?? t("table.title", { id: table.id });

  return (
    <section className="rounded-md border border-border bg-card shadow-xs" aria-labelledby={`${table.id}-title`}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={`${table.id}-title`} className="text-sm font-semibold">
            {tableTitle}
          </h2>
          <p className="text-xs text-muted-foreground">{t("table.pages", { start: table.pageStart, end: table.pageEnd })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
          {riskFilter}
          <span role="status" aria-atomic="true" className="text-xs text-muted-foreground">
            {t("table.rowRange", {
              start: visibleRows.length === 0 ? 0 : start + 1,
              end: start + visibleRows.length,
              filtered: filteredRows.length,
              total: table.rows.length,
            })}
          </span>
        </div>
      </div>

      {table.warnings.length > 0 && (
        <div className="border-b border-border bg-secondary/40 px-4 py-3 text-xs text-secondary-foreground">
          {table.warnings.map((warning) => (
            <p key={`${warning.code}-${JSON.stringify(warning.params)}`}>{t(getParseIssueKey(warning), warning.params)}</p>
          ))}
        </div>
      )}

      {onlyRiskRows && filteredRows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t("table.noRiskRows")}</p>
      ) : (
        <div className="isolate overflow-x-auto" role="region" tabIndex={0} aria-label={t("table.scrollRegion", { title: tableTitle })}>
          <table className="w-max min-w-7xl border-collapse text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 whitespace-nowrap border-r border-b border-border bg-muted px-3 py-2 font-medium"
                >
                  {t("table.status")}
                </th>
                {table.columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${columnWidthClass(column.index)} whitespace-nowrap border-b border-border px-3 py-2 font-medium`}
                  >
                    {getColumnLabel(column, (column) => t("table.unnamedColumn", { column }))}
                  </th>
                ))}
                {merchants?.headers.map((header, index) => (
                  <th key={index} scope="col" className="min-w-48 border-b border-border px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
                <th scope="col" className="min-w-48 border-b border-border px-3 py-2 font-medium">
                  {t("table.warnings")}
                </th>
                <th scope="col" className="min-w-24 border-b border-border px-3 py-2 font-medium">
                  {t("table.sourcePage")}
                </th>
                <th scope="col" className="min-w-24 border-b border-border px-3 py-2 font-medium">
                  {t("table.sourceRow")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const merchantName = merchants ? getMerchantName(merchants.normalization, table.id, row) : null;
                return (
                  <tr
                    key={`${table.id}-${row.source.page}-${row.source.row}`}
                    className={cn(
                      "align-top",
                      row.status === "valid" && "even:bg-muted/20",
                      row.status === "warning" && "bg-secondary/50",
                      row.status === "failed" && "bg-destructive/10",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-r border-b border-border bg-card px-3 py-2",
                        row.status === "warning" && "bg-secondary",
                        row.status === "failed" && "bg-[color-mix(in_oklch,var(--card),var(--destructive)_10%)]",
                      )}
                    >
                      <Badge variant={statusVariant(row.status)}>
                        {row.status === "warning" && <TriangleAlertIcon data-icon="inline-start" aria-hidden="true" />}
                        {row.status === "failed" && <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />}
                        {getRowRiskCode(row.status)}
                      </Badge>
                    </td>
                    {table.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`${columnWidthClass(column.index)} max-w-64 border-b border-border px-3 py-2 wrap-break-word whitespace-pre-wrap`}
                      >
                        {row.values[column.key] ?? "-"}
                      </td>
                    ))}
                    {merchants && (
                      <>
                        <td className="min-w-48 max-w-64 border-b border-border px-3 py-2 wrap-break-word whitespace-pre-wrap">
                          {merchantName ?? ""}
                        </td>
                        <td className="min-w-48 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                          {merchantName === null ? merchants.unassigned : merchants.confirmed}
                        </td>
                      </>
                    )}
                    <td className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                      {row.warnings.length > 0
                        ? row.warnings.map((warning) => t(getParseIssueKey(warning), warning.params)).join("; ")
                        : "-"}
                    </td>
                    <td className="border-b border-border px-3 py-2">{row.source.page}</td>
                    <td className="border-b border-border px-3 py-2">{row.source.row}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {previewRowLimit === undefined && pageCount > 1 && (
        <nav
          className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-4 py-3"
          aria-label={t("table.pagination", { title: tableTitle })}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setPagination({ onlyRiskRows, page: currentPage - 1 })}
          >
            {t("table.previous")}
          </Button>
          <span className="text-sm">{t("table.page", { page: currentPage, pages: pageCount })}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage === pageCount}
            onClick={() => setPagination({ onlyRiskRows, page: currentPage + 1 })}
          >
            {t("table.next")}
          </Button>
        </nav>
      )}
    </section>
  );
}

ConversionTable.displayName = "ConversionTable";
