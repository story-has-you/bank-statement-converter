import "server-only";

import { BillingError } from "./errors";
import type { PaymentProvider, PaymentProviderId } from "./provider";
import { creemProvider } from "./providers/creem/adapter";
import { paypalProvider } from "./providers/paypal/adapter";

const providers: Record<PaymentProviderId, PaymentProvider> = { paypal: paypalProvider, creem: creemProvider };

export function getPaymentProvider(value: unknown): PaymentProvider {
  if (typeof value !== "string" || !Object.hasOwn(providers, value)) {
    throw new BillingError("invalidProvider", 400);
  }
  return providers[value as PaymentProviderId];
}

export function isPaymentProviderEnabled(provider: PaymentProviderId): boolean {
  const value = provider === "paypal" ? process.env.PAYPAL_PAYMENT_ENABLED : process.env.CREEM_PAYMENT_ENABLED;
  return value === undefined || value.trim().toLowerCase() === "true";
}

/** 只公开渠道可用性和浏览器结账所需的非敏感配置。 */
export function getCheckoutConfigs() {
  return [providers.creem.getCheckoutConfig(), providers.paypal.getCheckoutConfig()].filter((checkout) => isPaymentProviderEnabled(checkout.provider));
}
