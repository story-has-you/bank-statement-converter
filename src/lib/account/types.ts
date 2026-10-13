import type { MembershipTier, SubscriptionStatus } from "@/lib/billing/types";

import type { PaymentProviderId } from "@/lib/billing/provider";

export type AccountSubscription = {
  provider: PaymentProviderId;
  subscriptionId: string;
  tier: MembershipTier;
  status: SubscriptionStatus;
  amount: number | null;
  originalAmount: number | null;
  discountAmount: number | null;
  currencyCode: string | null;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  entitlementActive: boolean;
};

export type AccountQuota = { period: "day" | "month"; usedPages: number; remainingPages: number; limitPages: number; remainingPercent: number; periodEnd: string };

export type AccountSnapshot = { subscriptions: AccountSubscription[] | null; quota: AccountQuota | null; currentTier: MembershipTier | null };
