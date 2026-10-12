import "server-only";

import { BillingError } from "./errors";
import type { PaymentProvider, PaymentProviderId } from "./provider";
import { paypalProvider } from "./providers/paypal/adapter";

const providers: Record<PaymentProviderId, PaymentProvider> = { paypal: paypalProvider };

export function getPaymentProvider(value: unknown): PaymentProvider {
  if (typeof value !== "string" || !Object.hasOwn(providers, value)) {
    throw new BillingError("invalidProvider", 400);
  }
  return providers[value as PaymentProviderId];
}

/** 当前仅开放一个渠道；新增渠道时显式调整注册表与结账配置。 */
export function getCheckoutConfig() {
  return providers.paypal.getCheckoutConfig();
}
