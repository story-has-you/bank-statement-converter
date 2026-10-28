export const editorialPages = [
  {
    id: "bestConverters",
    path: "/guides/best-bank-statement-converters",
    kind: "guide",
    checkedOn: "2026-10-28",
    sources: ["https://www.docuclipper.com/pricing/", "https://nanonets.com/pricing", "https://nanonets.com/bank-statement-converter/"],
  },
  {
    id: "docuclipper",
    path: "/compare/statementxl-vs-docuclipper",
    kind: "comparison",
    checkedOn: "2026-10-28",
    sources: ["https://www.docuclipper.com/pricing/"],
  },
  {
    id: "alternatives",
    path: "/alternatives/docuclipper",
    kind: "comparison",
    checkedOn: "2026-10-28",
    sources: ["https://www.docuclipper.com/pricing/", "https://nanonets.com/pricing"],
  },
  {
    id: "nanonets",
    path: "/compare/statementxl-vs-nanonets",
    kind: "comparison",
    checkedOn: "2026-10-28",
    sources: ["https://nanonets.com/pricing", "https://nanonets.com/bank-statement-converter/"],
  },
  {
    id: "xero",
    path: "/guides/bank-statement-to-xero",
    kind: "guide",
    checkedOn: "2026-10-27",
    sources: ["https://central.xero.com/0/article/Import-a-CSV-bank-statement"],
  },
  {
    id: "wave",
    path: "/guides/bank-statement-to-wave",
    kind: "guide",
    checkedOn: "2026-10-19",
    sources: ["https://support.waveapps.com/hc/en-us/articles/208621626-Upload-a-bank-or-credit-card-statement-in-csv-format"],
  },
  {
    id: "sage",
    path: "/guides/bank-statement-to-sage",
    kind: "guide",
    checkedOn: "2026-10-19",
    sources: ["https://gb-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=240718093942637"],
  },
  {
    id: "loan",
    path: "/guides/bank-statements-for-loan-applications",
    kind: "guide",
    checkedOn: "2026-10-19",
    sources: [],
  },
  {
    id: "tax",
    path: "/guides/bank-statements-for-tax-preparation",
    kind: "guide",
    checkedOn: "2026-10-19",
    sources: ["https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping"],
  },
  {
    id: "catchup",
    path: "/guides/catch-up-bookkeeping",
    kind: "guide",
    checkedOn: "2026-10-19",
    sources: [],
  },
  {
    id: "about",
    path: "/about",
    kind: "about",
    checkedOn: "2026-10-19",
    sources: ["https://dev.to/statementxl"],
  },
  {
    id: "checker",
    path: "/tools/bank-statement-balance-checker",
    kind: "tool",
    checkedOn: "2026-10-19",
    sources: [],
  },
  {
    id: "benchmark",
    path: "/research/bank-statement-parsing-benchmark",
    kind: "research",
    checkedOn: "2026-10-19",
    sources: [
      "https://www.carsonbank.com/wp-content/uploads/2021/01/Sample-Statement.pdf",
      "https://www.bhw.de/dam/bhwde/pdf/Jahreskontoauszuege_koop_2024.pdf",
    ],
  },
] as const;

export type EditorialPageId = (typeof editorialPages)[number]["id"];

export function findEditorialPage(path: string) {
  return editorialPages.find((page) => page.path === path);
}
