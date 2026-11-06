import type { MembershipTier } from "@/lib/billing/types";

export const freeQuotaConfig = { anonymous: { period: "day", pages: 1 }, authenticated: { period: "day", pages: 5 } } as const;

// New checkouts lock these USD prices; existing subscriptions retain their agreed price.
export const subscriptionConfig = {
  standard: { monthlyPrice: 9.9, period: "month", pages: 500, aiParsing: false },
  professional: { monthlyPrice: 24.9, period: "month", pages: 1000, aiParsing: true },
  enterprise: { monthlyPrice: 39.9, period: "month", pages: 2000, aiParsing: true },
} as const satisfies Record<MembershipTier, { monthlyPrice: number; period: "month"; pages: number; aiParsing: boolean }>;
