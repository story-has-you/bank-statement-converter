import "server-only";

import { membershipTiers } from "@/lib/billing/config";
import type { PaymentProvider } from "@/lib/billing/provider";
import { getPayPalConfig, getPayPalEnvironment, getPayPalPlanId } from "./config";
import {
  cancelPayPalSubscription,
  createPayPalCheckout,
  getPayPalSubscription,
  isPayPalSubscriptionId,
  resolvePayPalCheckout,
} from "./server";
import { normalizePayPalSubscription } from "./subscription";
import { parsePayPalWebhook } from "./webhook";

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  getCheckoutConfig: () => ({
    provider: "paypal",
    available: Boolean(getPayPalConfig()),
    availableTiers: membershipTiers.filter((tier) => getPayPalPlanId(tier)),
    settings: { environment: getPayPalEnvironment() },
  }),
  isConfigured: () => Boolean(getPayPalConfig()),
  getPlanId: getPayPalPlanId,
  isSubscriptionId: isPayPalSubscriptionId,
  createCheckout: createPayPalCheckout,
  resolveCheckout: resolvePayPalCheckout,
  getSubscription: async (id) => normalizePayPalSubscription(await getPayPalSubscription(id)),
  cancelSubscription: cancelPayPalSubscription,
  parseWebhook: parsePayPalWebhook,
};
