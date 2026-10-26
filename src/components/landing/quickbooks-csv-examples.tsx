import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function QuickbooksCsvExamples() {
  const t = await getTranslations("Landing.pages.quickbooks");
  const hasSamples = t.has("samples.title");
  const examples = [
    {
      columns: [t("headers.date"), t("headers.description"), t("headers.amount")],
      rows: [
        ["14/10/2026", t("samplePayment"), "-100.00"],
        ["15/10/2026", t("sampleDeposit"), "200.00"],
      ],
    },
    {
      columns: [t("headers.date"), t("headers.description"), t("headers.credit"), t("headers.debit")],
      rows: [
        ["14/10/2026", t("samplePayment"), "100.00", ""],
        ["15/10/2026", t("sampleDeposit"), "", "200.00"],
      ],
    },
  ];
  return (
    <section className="border-t border-border" aria-labelledby="csv-examples-title">
      <div className="mx-auto grid w-full max-w-4xl gap-5 px-5 py-12 sm:px-8">
        <h2 id="csv-examples-title" className="text-xl font-semibold">
          {t("examplesTitle")}
        </h2>
        {hasSamples && (
          <>
            <p className="text-sm leading-7 text-muted-foreground">{t("requirements")}</p>
            <p className="text-sm leading-7 text-muted-foreground">{t("preparation")}</p>
          </>
        )}
        <p className="text-sm leading-7 text-muted-foreground">{t("examplesNote")}</p>
        {examples.map((example, index) => (
          <div key={example.columns.length} className="grid min-w-0 gap-3">
            {hasSamples && <h3 className="font-medium">{t(index === 0 ? "threeColumnTitle" : "fourColumnTitle")}</h3>}
            <Table>
              <TableCaption>{t("columnsCaption", { count: example.columns.length })}</TableCaption>
              <TableHeader>
                <TableRow>
                  {example.columns.map((column) => (
                    <TableHead key={column} scope="col">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {example.rows.map((row) => (
                  <TableRow key={row[0]}>
                    {row.map((cell, index) => (
                      <TableCell key={index}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
        {hasSamples && (
          <>
            <div className="grid gap-3">
              <h3 className="font-medium">{t("samples.title")}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{t("samples.note")}</p>
              <div className="flex flex-wrap gap-3">
                <a href="/samples/quickbooks-3-column.csv" download className={buttonVariants({ variant: "outline" })}>
                  {t("samples.threeColumn")}
                </a>
                <a href="/samples/quickbooks-4-column.csv" download className={buttonVariants({ variant: "outline" })}>
                  {t("samples.fourColumn")}
                </a>
              </div>
            </div>
            <a href="#workspace" className={buttonVariants({ className: "h-auto w-fit max-w-full whitespace-normal py-2 text-center" })}>
              {t("convertCta")}
            </a>
          </>
        )}
      </div>
    </section>
  );
}
