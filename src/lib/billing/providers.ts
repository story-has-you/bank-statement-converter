import "server-only";

import { BillingError } from "./errors";
import type { PaymentProvider } from "./provider";
import { creemProvider } from "./providers/creem/adapter";

export function getPaymentProvider(value: unknown): PaymentProvider {
  if (value !== "creem") {
    throw new BillingError("invalidProvider", 400);
  }
  return creemProvider;
}

export function isPaymentProviderEnabled(): boolean {
  const value = process.env.CREEM_PAYMENT_ENABLED;
  return value === undefined || value.trim().toLowerCase() === "true";
}

/** 只公开渠道可用性和浏览器结账所需的非敏感配置。 */
export function getCheckoutConfigs() {
  return isPaymentProviderEnabled() ? [creemProvider.getCheckoutConfig()] : [];
}
