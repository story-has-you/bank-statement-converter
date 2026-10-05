import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

export function getPayPalApiTranslations() {
  return getTranslations({ locale: routing.defaultLocale, namespace: "PayPal.api" });
}
