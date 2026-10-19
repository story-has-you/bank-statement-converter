import { getFormatter, getTranslations } from "next-intl/server";

import report from "../../../public/research/bank-statement-parsing-benchmark.json";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function BenchmarkResults() {
  const [t, format] = await Promise.all([getTranslations("Benchmark"), getFormatter()]);
  const total = report.samples.reduce(
    (sum, s) => ({ rows: sum.rows + s.extractedRows, ok: sum.ok + s.statuses.OK, reference: sum.reference + s.referenceTransactions }),
    { rows: 0, ok: 0, reference: 0 },
  );
  return (
    <section className="grid gap-5" aria-label={t("title")}>
      <p className="text-sm leading-7">
        {t("summary", {
          layouts: report.samples.length,
          pages: report.samples.reduce((sum, s) => sum + s.selectedPageCount, 0),
          reference: total.reference,
          rows: total.rows,
          ok: total.ok,
          percentage: format.number(total.ok / total.rows, { style: "percent", maximumFractionDigits: 1 }),
        })}
      </p>
      <Table>
        <TableCaption>{t("caption")}</TableCaption>
        <TableHeader>
          <TableRow>
            {(["sample", "reference", "extracted", "statuses", "missing", "extra", "mismatches"] as const).map((key) => (
              <TableHead key={key} className="whitespace-normal">
                {t(key)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.samples.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.referenceTransactions}</TableCell>
              <TableCell>{s.extractedRows}</TableCell>
              <TableCell>
                {s.statuses.OK} / {s.statuses.DISCREPANCY} / {s.statuses.UNVERIFIABLE}
              </TableCell>
              <TableCell>{s.unmatchedReferenceRows}</TableCell>
              <TableCell>{s.extraRows}</TableCell>
              <TableCell>{s.fieldMismatches.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm leading-7 text-muted-foreground">{t("findings")}</p>
      <p className="text-sm leading-7 text-muted-foreground">{t("matching")}</p>
      <p className="text-xs text-muted-foreground">
        {t("measured", { date: format.dateTime(new Date(report.measuredAt), { dateStyle: "long", timeZone: "UTC" }) })}
      </p>
      <a href="/research/bank-statement-parsing-benchmark.json" download className="w-fit text-sm underline underline-offset-4">
        {t("download")}
      </a>
    </section>
  );
}
