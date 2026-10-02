import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-CN"],
  defaultLocale: "zh-CN",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});
