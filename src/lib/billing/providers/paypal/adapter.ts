import "server-only";

import { BillingError } from "@/lib/billing/errors";
import type { PaymentProvider } from "@/lib/billing/provider";

import { getPayPalClientId, getPayPalEnvironment, getPayPalPlanId, getPayPalPlans, getPayPalServerConfig } from "./config";
import { createPayPalSubscription, getPayPalSubscription, cancelPayPalSubscription } from "./server";
import { parsePayPalWebhook } from "./webhook";
import { normalizeSubscription } from "./subscription";

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  getCheckoutConfig() {
    return {
      provider: "paypal",
      available: Boolean(getPayPalClientId()),
      settings: { clientId: getPayPalClientId(), environment: getPayPalEnvironment() },
      availableTiers: getPayPalPlans().map((plan) => plan.tier),
    };
  },
  isConfigured: () => Boolean(getPayPalServerConfig()),
  getPlanId: getPayPalPlanId,
  isSubscriptionId(value): value is string {
    return typeof value === "string" && /^[A-Za-z0-9-]{1,64}$/.test(value);
  },
  async createSubscription(tier, userId) {
    const planId = getPayPalPlanId(tier);
    if (!planId) throw new BillingError("configurationMissing", 503);
    const subscription = await createPayPalSubscription(planId, userId);
    if (!subscription.id) throw new Error("PayPal did not return a subscription ID");
    return subscription.id;
  },
  async getSubscription(subscriptionId) {
    return normalizeSubscription(await getPayPalSubscription(subscriptionId));
  },
  cancelSubscription: cancelPayPalSubscription,
  parseWebhook: parsePayPalWebhook,
};
