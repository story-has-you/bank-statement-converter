"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { ParsedTable, RowStatus } from "@/lib/conversion-types";

type ConversionTableProps = {
  table: ParsedTable;
  title?: string;
};

function statusVariant(status: RowStatus): "default" | "secondary" | "destructive" {
  if (status === "failed") return "destructive";
  if (status === "warning") return "secondary";
  return "default";
}

function columnWidthClass(index: number): string {
  if (index === 0) return "min-w-40";
  if (index === 1 || index === 10 || index === 11) return "min-w-56";
  if (index === 6) return "min-w-44";
  if (index === 8 || index === 9) return "min-w-32";
  if (index === 12) return "min-w-40";
  return "min-w-28";
}

export function ConversionTable({ table, title }: ConversionTableProps) {
  const t = useTranslations("ConversionResult");

  function getStatusLabel(status: RowStatus): string {
    if (status === "failed") return t("rowStatus.failed");
    if (status === "warning") return t("rowStatus.warning");
    return t("rowStatus.valid");
  }

  return (
    <section className="rounded-md border border-border bg-card shadow-xs" aria-labelledby={`${table.id}-title`}>
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={`${table.id}-title`} className="text-sm font-semibold">
            {title ?? t("table.title", { id: table.id })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("table.pages", { start: table.pageStart, end: table.pageEnd })}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{t("table.rowCount", { count: table.rows.length })}</span>
      </div>

      {table.warnings.length > 0 && (
        <div className="border-b border-border bg-secondary/40 px-4 py-3 text-xs text-secondary-foreground">
          {table.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-max min-w-[1280px] border-collapse text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`${columnWidthClass(column.index)} whitespace-nowrap border-b border-border px-3 py-2 font-medium`}
                >
                  {column.label}
                </th>
              ))}
              <th scope="col" className="min-w-28 whitespace-nowrap border-b border-border px-3 py-2 font-medium">
                {t("table.status")}
              </th>
              <th scope="col" className="min-w-48 border-b border-border px-3 py-2 font-medium">
                {t("table.warnings")}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${table.id}-${row.source.page}-${row.source.row}`} className="align-top even:bg-muted/20">
                {table.columns.map((column) => (
                  <td
                    key={column.key}
                    className={`${columnWidthClass(column.index)} max-w-64 border-b border-border px-3 py-2 break-words whitespace-pre-wrap`}
                  >
                    {row.values[column.key] ?? "-"}
                  </td>
                ))}
                <td className="min-w-28 border-b border-border px-3 py-2">
                  <Badge variant={statusVariant(row.status)}>{getStatusLabel(row.status)}</Badge>
                </td>
                <td className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  {row.warnings.length > 0 ? row.warnings.join("; ") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

ConversionTable.displayName = "ConversionTable";
