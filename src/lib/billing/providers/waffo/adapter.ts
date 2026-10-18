import "server-only";

import { membershipTiers } from "@/lib/billing/config";
import type { PaymentProvider } from "@/lib/billing/provider";
import { getWaffoConfig, getWaffoEnvironment, getWaffoProductId } from "./config";
import { cancelWaffoSubscription, createWaffoCheckout, getWaffoSubscription, isWaffoOrderId, resolveWaffoCheckout } from "./server";
import { normalizeWaffoSubscription } from "./subscription";
import { parseWaffoWebhook } from "./webhook";

export const waffoProvider: PaymentProvider = {
  id: "waffo",
  getCheckoutConfig: () => ({
    provider: "waffo",
    available: Boolean(getWaffoConfig()),
    availableTiers: membershipTiers.filter((tier) => getWaffoProductId(tier)),
    settings: { environment: getWaffoEnvironment() },
  }),
  isConfigured: () => Boolean(getWaffoConfig()),
  getPlanId: getWaffoProductId,
  isSubscriptionId: isWaffoOrderId,
  createCheckout: createWaffoCheckout,
  resolveCheckout: resolveWaffoCheckout,
  getSubscription: async (id) => normalizeWaffoSubscription(await getWaffoSubscription(id)),
  cancelSubscription: cancelWaffoSubscription,
  parseWebhook: parseWaffoWebhook,
};
