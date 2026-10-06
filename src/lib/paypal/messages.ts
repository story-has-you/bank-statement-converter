import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";

export function getPayPalApiTranslations(request: Request) {
  return getTranslations({ locale: resolveLocale(request.headers.get("x-app-locale")), namespace: "PayPal.api" });
}
