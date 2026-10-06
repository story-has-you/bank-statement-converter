import { getTranslations } from "next-intl/server";

export function getPayPalApiTranslations() {
  return getTranslations({ locale: "en", namespace: "PayPal.api" });
}
