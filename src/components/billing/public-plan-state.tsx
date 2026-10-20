"use client";

import { useFormatter, useTranslations } from "next-intl";

import { usePublicAccount } from "@/components/account/public-account-provider";
import { PublicAccountStatus } from "@/components/account/public-account-status";
import { SubscriptionOptions } from "@/components/billing/subscription-options";
import type { CheckoutConfig } from "@/lib/billing/provider";
import type { MembershipTier } from "@/lib/billing/types";

export function PublicPlanState({ tier, checkouts }: { tier?: MembershipTier; checkouts?: CheckoutConfig[] }) {
  const { status, summary } = usePublicAccount();
  const t = useTranslations("UsageTiers");
  const format = useFormatter();
  if (status !== "ready") {
    return tier ? <PublicAccountStatus /> : null;
  }
  if (!tier) {
    return summary.cancelledPeriodEnd ? (
      <p role="status" className="mt-8 text-sm text-muted-foreground">
        {t("cancelledPeriodActive", {
          date: format.dateTime(new Date(summary.cancelledPeriodEnd), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }),
        })}
      </p>
    ) : null;
  }
  if (summary.hasSubscription) {
    return summary.activeTier === tier ? <p className="text-sm font-medium">{t("current")}</p> : null;
  }
  return <SubscriptionOptions checkouts={checkouts ?? []} signedIn={Boolean(summary.user)} tier={tier} />;
}
