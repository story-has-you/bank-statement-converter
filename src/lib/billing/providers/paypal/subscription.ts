import "server-only";

import type { Subscription } from "@paypal/paypal-server-sdk";
import type { ProviderSubscription } from "@/lib/billing/provider";
import { isSubscriptionStatus } from "@/lib/billing/types";
import { getPayPalPlans } from "./config";

export function normalizeSubscription(subscription: Subscription): ProviderSubscription {
  const plan = getPayPalPlans().find((candidate) => candidate.planId === subscription.planId);
  if (!subscription.id || !subscription.customId || !plan || !isSubscriptionStatus(subscription.status)) {
    throw new Error("PayPal subscription identity or status is incomplete");
  }
  return {
    subscriptionId: subscription.id,
    planId: plan.planId,
    userId: subscription.customId,
    tier: plan.tier,
    status: subscription.status,
    payerId: subscription.subscriber?.payerId ?? null,
    subscriberEmail: subscription.subscriber?.emailAddress ?? null,
    periodStart: subscription.startTime ?? null,
    periodEnd: subscription.billingInfo?.nextBillingTime ?? null,
  };
}
