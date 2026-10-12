import "server-only";

import type { PaymentProvider } from "@/lib/billing/provider";
import { membershipTiers } from "@/lib/billing/config";
import { getCreemConfig, getCreemEnvironment, getCreemProductId } from "./config";
import { cancelCreemSubscription, createCreemCheckout, getCreemSubscription, isCreemId, resolveCreemCheckout } from "./server";
import { normalizeCreemSubscription } from "./subscription";
import { parseCreemWebhook } from "./webhook";

export const creemProvider: PaymentProvider = {
  id: "creem",
  getCheckoutConfig: () => ({
    provider: "creem", available: Boolean(getCreemConfig()),
    availableTiers: membershipTiers.filter((tier) => getCreemProductId(tier)),
    settings: { environment: getCreemEnvironment() },
  }),
  isConfigured: () => Boolean(getCreemConfig()),
  getPlanId: getCreemProductId,
  isSubscriptionId: (value): value is string => isCreemId(value, "sub"),
  createCheckout: createCreemCheckout,
  resolveCheckout: resolveCreemCheckout,
  getSubscription: async (id) => normalizeCreemSubscription(await getCreemSubscription(id)),
  cancelSubscription: cancelCreemSubscription,
  parseWebhook: parseCreemWebhook,
};
