"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { CheckoutReturnStatus } from "@/components/billing/checkout-return-status";
import { isMembershipTier } from "@/lib/billing/config";
import { Link } from "@/i18n/navigation";

export function BillingReturnStatus({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("BillingReturn");
  const params = useSearchParams();
  const provider = params.get("provider") ?? "creem";
  const checkoutId = provider === "paypal" ? params.get("subscription_id") : params.get("checkout_id");
  const tier = params.get("tier");
  if (!signedIn) {
    return <p role="status">{t("signInRequired")}</p>;
  }
  if (provider !== "creem" && provider !== "paypal") {
    return <p role="alert">{t("invalidReturn")}</p>;
  }
  if (provider === "paypal" && params.get("cancelled") === "true") {
    return (
      <div className="grid gap-4">
        <p role="status">{t("cancelled")}</p>
        <Link href="/" className="text-sm underline">
          {t("backToPlans")}
        </Link>
      </div>
    );
  }
  const validId = provider === "paypal" ? /^I-[A-Z0-9]{1,64}$/ : /^ch_[A-Za-z0-9]{1,64}$/;
  if (!checkoutId || !validId.test(checkoutId) || !isMembershipTier(tier)) {
    return <p role="alert">{t("invalidReturn")}</p>;
  }
  return <CheckoutReturnStatus key={`${provider}:${checkoutId}:${tier}`} provider={provider} checkoutId={checkoutId} tier={tier} />;
}
