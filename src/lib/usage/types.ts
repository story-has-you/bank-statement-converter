export type ConversionQuota = {
  remainingPages: number;
  limitPages: number;
  period: "day" | "month";
  periodEnd: string;
};
