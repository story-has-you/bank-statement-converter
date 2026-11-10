import { getFormatter, getTranslations } from "next-intl/server";

import type { editorialPages } from "@/config/editorial-pages";

import { subscriptionConfig } from "@/config/plans";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ComparisonPageId = Extract<(typeof editorialPages)[number], { kind: "comparison" }>["id"];

export async function ComparisonTable({ id }: { id: ComparisonPageId }) {
  const [t, format] = await Promise.all([getTranslations("Comparison"), getFormatter()]);
  const competitors: Exclude<ComparisonPageId, "alternatives">[] = id === "alternatives" ? ["docuclipper", "nanonets"] : [id];
  const price = format.number(subscriptionConfig.standard.monthlyPrice, {
    style: "currency", currency: "USD", currencyDisplay: "code",
  });
  return (
    <Table>
      <TableCaption>{t("caption")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("criterion")}</TableHead>
          <TableHead>{t("names.statementxl")}</TableHead>
          {competitors.map((name) => (
            <TableHead key={name}>{t(`names.${name}`)}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {(["workflow", "processing", "review", "exports", "integration", "pricing"] as const).map((row) => (
          <TableRow key={row}>
            <TableHead className="whitespace-normal">{t(`labels.${row}`)}</TableHead>
            <TableCell className="min-w-48 whitespace-normal align-top leading-7">
              {t(`statementxl.${row}`, { price, pages: format.number(subscriptionConfig.standard.pages) })}
            </TableCell>
            {competitors.map((name) => (
              <TableCell key={name} className="min-w-48 whitespace-normal align-top leading-7">
                {t(`${name}.${row}`)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
