import type { MembershipTier } from "@/lib/billing/types";

export const freeQuotaConfig = { anonymous: { period: "day", pages: 1 }, authenticated: { period: "day", pages: 5 } } as const;

// Prices shown on the site must match the corresponding payment provider plans.
export const subscriptionConfig = {
  standard: { monthlyPrice: 19.9, period: "month", pages: 500, qwenFallback: false },
  professional: { monthlyPrice: 49.9, period: "month", pages: 1000, qwenFallback: true },
  enterprise: { monthlyPrice: 79.9, period: "month", pages: 2000, qwenFallback: true },
} as const satisfies Record<MembershipTier, { monthlyPrice: number; period: "month"; pages: number; qwenFallback: boolean }>;
