import { useState } from "react";
import { useTranslations } from "next-intl";

import { ConversionTable } from "@/components/conversion/conversion-table";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { ParseResponse } from "@/lib/conversion-types";

type ConversionReviewProps = { result: ParseResponse };

export function ConversionReview({ result }: ConversionReviewProps) {
  const t = useTranslations("ConversionResult");
  const [onlyRiskRows, setOnlyRiskRows] = useState(false);
  const riskRowCount = result.summary.warningRowCount + result.summary.failedRowCount;

  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-atomic="true" className="sr-only">
        {onlyRiskRows
          ? t("review.showingRiskRows", { count: riskRowCount })
          : t("review.showingAllRows", { count: result.summary.rowCount })}
      </div>
      {result.tables.map((table) => (
        <ConversionTable
          key={table.id}
          table={table}
          onlyRiskRows={onlyRiskRows}
          title={result.tables.length === 1 ? t("table.singleTitle") : undefined}
          riskFilter={
            riskRowCount > 0 && (
              <Field orientation="horizontal" className="w-auto">
                <Switch
                  id={`${table.id}-risk-filter`}
                  checked={onlyRiskRows}
                  onCheckedChange={setOnlyRiskRows}
                  nativeButton
                  render={<button type="button" />}
                />
                <FieldLabel htmlFor={`${table.id}-risk-filter`}>{t("review.onlyRiskRows")}</FieldLabel>
              </Field>
            )
          }
        />
      ))}
    </div>
  );
}

ConversionReview.displayName = "ConversionReview";
