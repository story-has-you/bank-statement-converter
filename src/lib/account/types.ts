import type { MembershipTier, SubscriptionStatus } from "@/lib/billing/types";

export type AccountSubscription = {
  subscriptionId: string;
  tier: MembershipTier;
  status: SubscriptionStatus;
  amount: number | null;
  currencyCode: string | null;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  entitlementActive: boolean;
};

export type AccountQuota = {
  period: "day" | "month";
  usedPages: number;
  remainingPages: number;
  limitPages: number;
  remainingPercent: number;
  periodEnd: string;
};

export type AccountSnapshot = {
  subscriptions: AccountSubscription[] | null;
  quota: AccountQuota | null;
  currentTier: MembershipTier | null;
};
