import { getLocale, getTranslations } from "next-intl/server";

import sample from "../../../public/samples/demo-statement-result.json";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";

export async function HomeSample() {
  const [locale, t, resources] = await Promise.all([getLocale(), getTranslations("HomeSample"), getTranslations("Resources")]);
  const table = sample.tables[0];

  return (
    <section className="px-5 sm:px-8" aria-labelledby="sample-title">
      <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-5 border-t border-foreground pb-12 pt-6">
        <div className="grid items-baseline gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <h2 id="sample-title" className="font-heading text-2xl font-medium sm:text-3xl">
            {t("title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{t("description")}</p>
        </div>
        <Table className="[&_td]:h-11 [&_td]:px-3 [&_td:nth-child(n+3)]:text-right [&_th]:bg-muted [&_th]:px-3 [&_th]:text-xs [&_th]:text-muted-foreground [&_th:nth-child(n+3)]:text-right">
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
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <a
            href="/samples/demo-statement.pdf"
            download
            className={buttonVariants({ variant: "link", className: "h-auto px-0 underline" })}
          >
            {t("downloadPdf")}
          </a>
          <a
            href={`/samples/demo-statement-${locale}.xlsx`}
            download
            className={buttonVariants({ variant: "link", className: "h-auto px-0 underline" })}
          >
            {t("downloadExcel")}
          </a>
          <a
            href={`/samples/demo-statement-${locale}.csv`}
            download
            className={buttonVariants({ variant: "link", className: "h-auto px-0 underline" })}
          >
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
