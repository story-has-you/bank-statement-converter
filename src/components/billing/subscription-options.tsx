import { getTranslations } from "next-intl/server";
import type { CheckoutConfig } from "@/lib/billing/provider";
import type { MembershipTier } from "@/lib/billing/types";
import { SubscriptionButton } from "./subscription-button";

export async function SubscriptionOptions({
  checkouts,
  tier,
  signedIn,
  current,
}: {
  checkouts: CheckoutConfig[];
  tier: MembershipTier;
  signedIn: boolean;
  current: boolean;
}) {
  const t = await getTranslations("Billing");
  if (current) {
    return <p className="text-sm font-medium text-primary">{t("currentPlan")}</p>;
  }
  if (!signedIn) {
    return <p className="text-sm text-muted-foreground">{t("signInRequired")}</p>;
  }
  if (checkouts.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-2">
      <div className="grid auto-cols-fr grid-flow-col items-start gap-3">
        {checkouts.map((checkout) => (
          <SubscriptionButton key={checkout.provider} checkout={checkout} tier={tier} />
        ))}
      </div>
      {checkouts.some((checkout) => checkout.provider === "waffo") && <p className="text-xs text-muted-foreground">{t("waffoTaxNote")}</p>}
    </div>
  );
}
