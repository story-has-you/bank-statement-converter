const production = process.env.NEXT_PUBLIC_APP_ENV === "production";
const testMeasurementId = process.env.NEXT_PUBLIC_GA4_TEST_MEASUREMENT_ID?.trim();
export const productionMeasurementId = "G-93LC8N8C85";
export const analyticsMeasurementId = production
  ? productionMeasurementId
  : testMeasurementId && /^G-[A-Z0-9]+$/.test(testMeasurementId) && testMeasurementId !== productionMeasurementId
    ? testMeasurementId
    : undefined;
export const funnelAnalyticsEnabled = Boolean(analyticsMeasurementId);
export const analyticsTestMode = !production;
export const loginPendingCookie = "bank-statement-converter-login-pending";
export const trialPendingCookie = "bank-statement-converter-trial-pending";
