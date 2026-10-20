import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConversionTable } from "@/components/conversion/conversion-table";
import { Button } from "@/components/ui/button";
import { CONVERSION_VISIBLE_ROW_LIMIT } from "@/config/conversion";
import { useRouter } from "@/i18n/navigation";
import type { ConversionPreview } from "@/lib/conversion-stream-client";

export function ConversionProgress({
  filename,
  preview,
  onCancel,
}: {
  filename: string;
  preview: ConversionPreview;
  onCancel: () => void;
}) {
  const t = useTranslations("ConversionResult");
  const router = useRouter();
  const rowCount = preview.tables.reduce((count, table) => count + table.rows.length, 0);
  const visibleTables = [];
  let remainingRows = CONVERSION_VISIBLE_ROW_LIMIT;
  for (const table of preview.tables) {
    if (remainingRows === 0) {
      break;
    }
    if (table.rows.length > 0 || (rowCount === 0 && visibleTables.length === 0)) {
      const rowLimit = Math.min(table.rows.length, remainingRows);
      visibleTables.push({ table, rowLimit });
      remainingRows -= rowLimit;
    }
  }

  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-all text-xl font-semibold">{filename}</h1>
          <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            {t(`stream.stages.${preview.stage}`)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{t("stream.previewNotice", { limit: CONVERSION_VISIBLE_ROW_LIMIT })}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("stream.previewCount", { tables: preview.tables.length, rows: rowCount })}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            onCancel();
            router.push("/");
          }}
        >
          {t("stream.cancel")}
        </Button>
      </div>
      {visibleTables.map(({ table, rowLimit }) => (
        <ConversionTable key={table.id} table={table} title={t("table.title", { id: table.id })} previewRowLimit={rowLimit} />
      ))}
    </div>
  );
}
