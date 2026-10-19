import { getTranslations } from "next-intl/server";

import type { editorialPages } from "@/config/editorial-pages";

import { subscriptionConfig } from "@/config/plans";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ComparisonPageId = Extract<(typeof editorialPages)[number], { kind: "comparison" }>["id"];

export async function ComparisonTable({ id }: { id: ComparisonPageId }) {
  const t = await getTranslations("Comparison");
  const competitors: ("docuclipper" | "nanonets")[] = id === "alternatives" ? ["docuclipper", "nanonets"] : [id];
  return (
    <Table>
      <TableCaption>{t("caption")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("criterion")}</TableHead>
          <TableHead>StatementXL</TableHead>
          {competitors.map((name) => (
            <TableHead key={name}>{name === "docuclipper" ? "DocuClipper" : "Nanonets"}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {(["workflow", "exports", "integration", "pricing"] as const).map((row) => (
          <TableRow key={row}>
            <TableHead className="whitespace-normal">{t(`labels.${row}`)}</TableHead>
            <TableCell className="min-w-48 whitespace-normal align-top leading-7">
              {t(`statementxl.${row}`, { price: subscriptionConfig.standard.monthlyPrice, pages: subscriptionConfig.standard.pages })}
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
