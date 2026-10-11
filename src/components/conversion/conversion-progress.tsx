import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConversionTable } from "@/components/conversion/conversion-table";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { ConversionPreview } from "@/lib/conversion-stream-client";

export function ConversionProgress({ filename, preview, onCancel }: {
  filename: string; preview: ConversionPreview; onCancel: () => void;
}) {
  const t = useTranslations("ConversionResult");
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-all text-xl font-semibold">{filename}</h1>
          <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            {t(`stream.stages.${preview.stage}`)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{t("stream.previewNotice")}</p>
        </div>
        <Button variant="outline" onClick={() => { onCancel(); router.push("/"); }}>{t("stream.cancel")}</Button>
      </div>
      {preview.tables.map((table, index) => (
        <ConversionTable key={index} table={table} title={t("table.title", { id: table.id })} />
      ))}
    </div>
  );
}
