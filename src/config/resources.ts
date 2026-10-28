import { publicContentPages } from "@/config/public-pages";
import type { AppLocale } from "@/i18n/routing";

type ResourcePageId = Exclude<(typeof publicContentPages)[number]["id"], "about" | "resources">;

const resourceGroups = [
  { id: "conversion", pageIds: ["pdf", "csv", "scanned"] },
  { id: "banks", pageIds: ["chase", "bofa", "wellsFargo", "hsbc"] },
  { id: "accounting", pageIds: ["quickbooks", "xero", "wave", "sage"] },
  { id: "bookkeeping", pageIds: ["loan", "tax", "catchup"] },
  { id: "comparisons", pageIds: ["bestConverters", "docuclipper", "alternatives", "nanonets"] },
  { id: "tools", pageIds: ["checker", "benchmark"] },
] as const satisfies readonly { id: string; pageIds: readonly ResourcePageId[] }[];

type ResourceGroupId = (typeof resourceGroups)[number]["id"];

// Order reflects the researched tasks; every market keeps the complete directory.
const marketResources = {
  en: {
    groups: ["conversion", "accounting", "banks", "comparisons", "tools", "bookkeeping"],
    featured: ["pdf", "csv", "quickbooks", "checker"],
  },
  "zh-CN": {
    groups: ["conversion", "tools", "comparisons", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "csv", "scanned", "checker"],
  },
  ja: {
    groups: ["conversion", "tools", "comparisons", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "scanned", "csv", "checker"],
  },
  ko: {
    groups: ["conversion", "tools", "comparisons", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "csv", "checker", "scanned"],
  },
  de: {
    groups: ["conversion", "comparisons", "tools", "bookkeeping", "banks", "accounting"],
    featured: ["csv", "pdf", "checker", "scanned"],
  },
  fr: {
    groups: ["conversion", "tools", "comparisons", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "csv", "checker", "scanned"],
  },
  es: {
    groups: ["conversion", "comparisons", "tools", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "csv", "scanned", "checker"],
  },
  "pt-BR": {
    groups: ["conversion", "comparisons", "tools", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "csv", "checker", "scanned"],
  },
  it: {
    groups: ["conversion", "tools", "comparisons", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "csv", "checker", "scanned"],
  },
  nl: {
    groups: ["conversion", "comparisons", "tools", "bookkeeping", "banks", "accounting"],
    featured: ["csv", "pdf", "scanned", "checker"],
  },
  hi: {
    groups: ["conversion", "tools", "comparisons", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "csv", "scanned", "checker"],
  },
  id: {
    groups: ["conversion", "tools", "comparisons", "bookkeeping", "banks", "accounting"],
    featured: ["pdf", "checker", "csv", "scanned"],
  },
} as const satisfies Record<AppLocale, { groups: readonly ResourceGroupId[]; featured: readonly ResourcePageId[] }>;

export function getResourceGroups(locale: AppLocale) {
  return marketResources[locale].groups.map((id) => resourceGroups.find((group) => group.id === id)!);
}

export function getResourcePage(id: ResourcePageId) {
  return { id, path: publicContentPages.find((page) => page.id === id)!.path };
}

/** Keep recommendations small and related; the directory owns the complete list. */
export function getRelatedResources(locale: AppLocale, current?: string) {
  const groups = getResourceGroups(locale);
  const group = groups.find((item) => item.pageIds.some((id) => id === current));
  const ids = [
    ...new Set<ResourcePageId>([...(group?.pageIds ?? []), ...marketResources[locale].featured, ...groups.flatMap((item) => item.pageIds)]),
  ]
    .filter((id) => id !== current)
    .slice(0, 4);
  return ids.map(getResourcePage);
}
