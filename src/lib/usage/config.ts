import type { MembershipTier } from "@/lib/billing/types";

export const usageQuotaConfig = {
  timezone: "UTC",
  anonymous: {
    period: "day",
    pages: 1,
  },
  authenticated: {
    period: "day",
    pages: 5,
  },
  subscriptions: {
    standard: {
      period: "month",
      pages: 400,
    },
    professional: {
      period: "month",
      pages: 1000,
    },
    enterprise: {
      period: "month",
      pages: 4000,
    },
  },
} as const satisfies {
  timezone: "UTC";
  anonymous: { period: "day"; pages: number };
  authenticated: { period: "day"; pages: number };
  subscriptions: Record<MembershipTier, { period: "month"; pages: number }>;
};

export type UsagePeriod = "day" | "month";
