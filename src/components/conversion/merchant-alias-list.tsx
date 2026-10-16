import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ParseResponse } from "@/lib/conversion-types";
import type { MerchantAlias } from "@/lib/merchant-normalization";

type MerchantAliasListProps = {
  aliases: MerchantAlias[];
  result: ParseResponse;
  selected: Set<string>;
  onToggle: (value: string, checked: boolean) => void;
};

export function MerchantAliasList({ aliases, result, selected, onToggle }: MerchantAliasListProps) {
  const t = useTranslations("ConversionResult");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <span className="sr-only">{t("merchant.selection")}</span>
          </TableHead>
          <TableHead>{t("merchant.original")}</TableHead>
          <TableHead>{t("merchant.name")}</TableHead>
          <TableHead>{t("merchant.tables")}</TableHead>
          <TableHead>{t("merchant.transactions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {aliases.map((alias) => (
          <TableRow key={alias.value}>
            <TableCell>
              <Checkbox
                checked={selected.has(alias.value)}
                onCheckedChange={(checked) => onToggle(alias.value, checked)}
                aria-label={t("merchant.selectAlias", { alias: alias.value })}
              />
            </TableCell>
            <TableCell className="min-w-48 max-w-80 wrap-break-word whitespace-pre-wrap">{alias.value}</TableCell>
            <TableCell className="min-w-40 max-w-64 wrap-break-word whitespace-pre-wrap">
              {alias.names.map((name) => name ?? t("merchant.unassigned")).join("; ")}
            </TableCell>
            <TableCell>
              {alias.tableIds
                .map((id) => t("excel.sheetName", { index: result.tables.findIndex((table) => table.id === id) + 1 }))
                .join(", ")}
            </TableCell>
            <TableCell>{t("merchant.rowCount", { count: alias.rowCount })}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

MerchantAliasList.displayName = "MerchantAliasList";
