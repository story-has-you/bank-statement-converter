"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { CheckoutReturnStatus } from "@/components/billing/checkout-return-status";
import { isMembershipTier } from "@/lib/billing/config";

export function BillingReturnStatus({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("BillingReturn");
  const params = useSearchParams();
  const checkoutId = params.get("checkout_id");
  const tier = params.get("tier");
  if (!signedIn) return <p role="status">{t("signInRequired")}</p>;
  if (!checkoutId || !/^ch_[A-Za-z0-9]{1,64}$/.test(checkoutId) || !isMembershipTier(tier)) return <p role="alert">{t("invalidReturn")}</p>;
  return <CheckoutReturnStatus key={`${checkoutId}:${tier}`} checkoutId={checkoutId} tier={tier} />;
}
