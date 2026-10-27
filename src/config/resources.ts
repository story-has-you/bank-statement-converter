import { publicContentPages } from "@/config/public-pages";

type ResourcePageId = Exclude<(typeof publicContentPages)[number]["id"], "about" | "resources">;

export const resourceGroups = [
  { id: "conversion", pageIds: ["pdf", "scanned"] },
  { id: "banks", pageIds: ["chase", "bofa", "wellsFargo", "hsbc"] },
  { id: "accounting", pageIds: ["quickbooks", "xero", "wave", "sage"] },
  { id: "bookkeeping", pageIds: ["loan", "tax", "catchup"] },
  { id: "comparisons", pageIds: ["docuclipper", "alternatives", "nanonets"] },
  { id: "tools", pageIds: ["checker", "benchmark"] },
] as const satisfies readonly { id: string; pageIds: readonly ResourcePageId[] }[];

const featuredResourceIds = ["pdf", "scanned", "quickbooks", "checker"] as const;

export function getResourcePage(id: ResourcePageId) {
  return { id, path: publicContentPages.find((page) => page.id === id)!.path };
}

/** Keep recommendations small and related; the directory owns the complete list. */
export function getRelatedResources(current?: string) {
  const group = resourceGroups.find((item) => item.pageIds.some((id) => id === current));
  let priorityIds: ResourcePageId[] = [];
  if (group?.id === "banks") {
    priorityIds = ["quickbooks"];
  } else if (group?.id === "comparisons") {
    priorityIds = ["benchmark", "checker"];
  }
  const ids = [...new Set([...priorityIds, ...(group?.pageIds ?? []), ...featuredResourceIds])].filter((id) => id !== current).slice(0, 4);
  return ids.map(getResourcePage);
}
