import "server-only";

import { BillingError } from "./errors";
import type { PaymentProvider, PaymentProviderId } from "./provider";
import { creemProvider } from "./providers/creem/adapter";
import { paypalProvider } from "./providers/paypal/adapter";

const providers: PaymentProvider[] = [creemProvider, paypalProvider];

export function getPaymentProvider(value: unknown): PaymentProvider {
  const provider = providers.find((candidate) => candidate.id === value);
  if (!provider) {
    throw new BillingError("invalidProvider", 400);
  }
  return provider;
}

export function isPaymentProviderEnabled(provider: PaymentProviderId): boolean {
  const value = process.env[`${provider.toUpperCase()}_PAYMENT_ENABLED`];
  return value === undefined ? provider === "creem" : value.trim().toLowerCase() === "true";
}

/** 只公开渠道可用性和浏览器结账所需的非敏感配置。 */
export function getCheckoutConfigs() {
  return providers.filter((provider) => isPaymentProviderEnabled(provider.id)).map((provider) => provider.getCheckoutConfig());
}
