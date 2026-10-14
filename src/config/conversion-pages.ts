export const conversionPages = [
  { id: "pdf", path: "/pdf-bank-statement-to-excel", checkedOn: "2026-10-13", sources: [] },
  { id: "chase", path: "/banks/chase-statement-to-excel", checkedOn: "2026-10-13", sources: ["https://www.chase.com/personal/mobile-online-banking/login-paperless"] },
  { id: "bofa", path: "/banks/bank-of-america-statement-to-excel", checkedOn: "2026-10-13", sources: ["https://info.bankofamerica.com/en/digital-banking"] },
  {
    id: "wellsFargo",
    path: "/banks/wells-fargo-statement-to-excel",
    checkedOn: "2026-10-13",
    sources: ["https://www.wellsfargo.com/help/online-banking/statement-faqs/", "https://www.wellsfargo.com/biz/online-banking/statements/"],
  },
  { id: "scanned", path: "/scanned-bank-statement-to-excel", checkedOn: "2026-10-14", sources: [] },
  {
    id: "quickbooks",
    path: "/guides/bank-statement-to-quickbooks",
    checkedOn: "2026-10-14",
    sources: [
      "https://quickbooks.intuit.com/learn-support/en-us/help-article/bank-transactions/format-csv-files-excel-bank-transactions-quickbooks/L4BjLWckq_US_en_US",
      "https://quickbooks.intuit.com/learn-support/en-us/help-article/import-transactions/manually-upload-transactions-quickbooks-online/L0rE9OXBz_US_en_US",
    ],
  },
] as const;

export type ConversionPageId = (typeof conversionPages)[number]["id"];

export const bankPages = conversionPages.filter((page) => page.path.startsWith("/banks/"));

export function findBankPage(slug: string) {
  return bankPages.find((page) => page.path === `/banks/${slug}`);
}
