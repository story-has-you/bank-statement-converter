import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LandingContent } from "@/lib/seo/landing-content";

export function QuickbooksImportErrors({ content }: { content: NonNullable<LandingContent["quickbooks"]>["errors"] }) {
  return (
    <section className="border-t border-border" aria-labelledby="quickbooks-errors-title">
      <div className="mx-auto grid w-full max-w-4xl gap-5 px-5 py-12 sm:px-8">
        <h2 id="quickbooks-errors-title" className="text-xl font-semibold">
          {content.title}
        </h2>
        <div
          role="region"
          aria-labelledby="quickbooks-errors-title"
          tabIndex={0}
          className="min-w-0 overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-ring [&>[data-slot=table-container]]:overflow-visible"
        >
          <Table className="min-w-[36rem] table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:align-top [&_td]:break-words [&_td]:leading-7">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-1/4">
                  {content.headers.symptom}
                </TableHead>
                <TableHead scope="col" className="w-1/4">
                  {content.headers.cause}
                </TableHead>
                <TableHead scope="col">{content.headers.fix}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.rows.map((row) => (
                <TableRow key={row.symptom}>
                  <TableCell>{row.symptom}</TableCell>
                  <TableCell>{row.cause}</TableCell>
                  <TableCell>{row.fix}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm leading-7">
          <a href="#workspace" className="underline underline-offset-4">
            {content.ctaText}
          </a>
        </p>
      </div>
    </section>
  );
}
