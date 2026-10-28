import { conversionPages } from "@/config/conversion-pages";
import { editorialPages } from "@/config/editorial-pages";

export const publicContentPages = [
  ...conversionPages.map((page) => ({ ...page, messageKey: `Landing.pages.${page.id}.label` as const })),
  ...editorialPages.map((page) => ({ ...page, messageKey: `Editorial.pages.${page.id}.title` as const })),
  { id: "resources", path: "/resources", checkedOn: "2026-10-28", messageKey: "Resources.title" } as const,
];

export const publicPaths = ["/", "/terms", "/privacy", ...publicContentPages.map((page) => page.path)];
