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
] as const;

export type ConversionPageId = (typeof conversionPages)[number]["id"];

export const bankPages = conversionPages.filter((page) => page.id !== "pdf");

export function findBankPage(slug: string) {
  return bankPages.find((page) => page.path === `/banks/${slug}`);
}
