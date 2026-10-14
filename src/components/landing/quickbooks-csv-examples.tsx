import { getTranslations } from "next-intl/server";

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function QuickbooksCsvExamples() {
  const t = await getTranslations("Landing.pages.quickbooks");
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
        <p className="text-sm leading-7 text-muted-foreground">{t("examplesNote")}</p>
        {examples.map((example) => (
          <Table key={example.columns.length}>
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
        ))}
      </div>
    </section>
  );
}
