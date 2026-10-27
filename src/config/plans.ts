import type { MembershipTier } from "@/lib/billing/types";

export const freeQuotaConfig = { anonymous: { period: "day", pages: 1 }, authenticated: { period: "day", pages: 5 } } as const;

// Prices shown on the site must match the corresponding payment provider plans.
export const subscriptionConfig = {
  standard: { monthlyPrice: 9.9, period: "month", pages: 500, aiParsing: false },
  professional: { monthlyPrice: 49.9, period: "month", pages: 1000, aiParsing: true },
  enterprise: { monthlyPrice: 79.9, period: "month", pages: 2000, aiParsing: true },
} as const satisfies Record<MembershipTier, { monthlyPrice: number; period: "month"; pages: number; aiParsing: boolean }>;
