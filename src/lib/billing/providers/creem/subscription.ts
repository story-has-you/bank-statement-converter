import "server-only";

import type { SubscriptionEntity } from "creem/models/components";
import type { ProviderSubscription } from "@/lib/billing/provider";
import type { SubscriptionStatus } from "@/lib/billing/types";
import { getCreemTier } from "./config";

export function normalizeCreemSubscription(remote: SubscriptionEntity): ProviderSubscription {
  const productId = typeof remote.product === "string" ? remote.product : remote.product.id;
  const tier = getCreemTier(productId);
  const userId: unknown = remote.metadata?.referenceId;
  const statuses: Record<string, SubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "APPROVAL_PENDING",
    paused: "SUSPENDED",
    expired: "EXPIRED",
    canceled: "CANCELLED",
    scheduled_cancel: "CANCELLED",
    past_due: "PAYMENT_FAILED",
    unpaid: "PAYMENT_FAILED",
  };
  const status = statuses[remote.status];
  if (!tier || !status || typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Creem subscription identity is incomplete");
  }
  const customer = typeof remote.customer === "string" ? null : remote.customer;
  return {
    subscriptionId: remote.id,
    planId: productId,
    userId,
    tier,
    status,
    payerId: typeof remote.customer === "string" ? remote.customer : remote.customer.id,
    subscriberEmail: customer?.email ?? null,
    periodStart: remote.currentPeriodStartDate?.toISOString() ?? null,
    periodEnd: remote.currentPeriodEndDate?.toISOString() ?? null,
  };
}
