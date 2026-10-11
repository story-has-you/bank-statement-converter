import { freeQuotaConfig, subscriptionConfig } from "@/config/plans";

export const usageQuotaConfig = {
  timezone: "UTC",
  ...freeQuotaConfig,
  subscriptions: subscriptionConfig,
} as const;

export type UsagePeriod = "day" | "month";
