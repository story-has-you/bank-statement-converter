"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { CheckoutReturnStatus } from "@/components/billing/checkout-return-status";
import { isMembershipTier } from "@/lib/billing/config";

export function BillingReturnStatus({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("BillingReturn");
  const params = useSearchParams();
  const provider = params.get("provider");
  const checkoutId = params.get("checkout_id");
  const tier = params.get("tier");
  if (!signedIn) {
    return <p role="status">{t("signInRequired")}</p>;
  }
  if (provider !== "waffo") {
    return <p role="alert">{t("invalidReturn")}</p>;
  }
  const validId = /^wco_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!checkoutId || !validId.test(checkoutId) || !isMembershipTier(tier)) {
    return <p role="alert">{t("invalidReturn")}</p>;
  }
  return <CheckoutReturnStatus key={`${provider}:${checkoutId}:${tier}`} provider={provider} checkoutId={checkoutId} tier={tier} />;
}
