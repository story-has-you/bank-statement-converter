import { getLocale, getTranslations } from "next-intl/server";

import sample from "../../../public/samples/demo-statement-result.json";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";

export async function HomeSample() {
  const [locale, t, resources] = await Promise.all([getLocale(), getTranslations("HomeSample"), getTranslations("Resources")]);
  const table = sample.tables[0];

  return (
    <section className="border-t border-border" aria-labelledby="sample-title">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-12 sm:px-8">
        <div className="grid gap-3">
          <h2 id="sample-title" className="text-xl font-semibold sm:text-2xl">
            {t("title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{t("description")}</p>
        </div>
        <Table>
          <TableCaption>{t("caption")}</TableCaption>
          <TableHeader>
            <TableRow>
              {table.columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row) => (
              <TableRow key={row.source.row}>
                {Object.entries(row.values).map(([key, value]) => (
                  <TableCell key={key}>{value}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap gap-3">
          <a href="/samples/demo-statement.pdf" download className={buttonVariants({ variant: "outline" })}>
            {t("downloadPdf")}
          </a>
          <a href={`/samples/demo-statement-${locale}.xlsx`} download className={buttonVariants({ variant: "outline" })}>
            {t("downloadExcel")}
          </a>
          <a href={`/samples/demo-statement-${locale}.csv`} download className={buttonVariants({ variant: "outline" })}>
            {t("downloadCsv")}
          </a>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{t("limitation")}</p>
        <Link href="/research/bank-statement-parsing-benchmark" className="w-fit text-sm underline underline-offset-4">
          {resources("links.benchmark")}
        </Link>
      </div>
    </section>
  );
}
