export type ConversionQuota = {
  remainingPages: number;
  limitPages: number;
  remainingAiPages: number;
  aiLimitPages: number;
  period: "day" | "month";
  periodEnd: string;
};
