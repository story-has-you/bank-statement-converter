"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type ExcelDownloadProps = { disabled: boolean; onDownload: () => void; className?: string };

export function ExcelDownload({ disabled, onDownload, className }: ExcelDownloadProps) {
  const t = useTranslations("ConversionResult");
  return (
    <Button type="button" size="lg" className={className} onClick={onDownload} disabled={disabled}>
      <DownloadIcon data-icon="inline-start" />
      {t("download")}
    </Button>
  );
}

ExcelDownload.displayName = "ExcelDownload";
