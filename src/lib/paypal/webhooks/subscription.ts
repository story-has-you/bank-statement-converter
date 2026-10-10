import type { Subscription } from "@paypal/paypal-server-sdk";

import {
  findBillingSubscriptionByPayPalId,
  type BillingSubscription,
} from "@/lib/billing/server";
import { getPayPalSubscription } from "@/lib/paypal/server";
import { requireString, type WebhookEvent } from "@/lib/paypal/webhooks/shared";

/** 读取并核对已有订阅；重复事件返回 null，未落库的激活要求重试。 */
export async function getVerifiedSubscription(
  subscriptionIdValue: unknown,
  event: WebhookEvent,
): Promise<{
  existing: BillingSubscription;
  subscription: Subscription;
} | null> {
  const subscriptionId = requireString(subscriptionIdValue);
  const existing = await findBillingSubscriptionByPayPalId(subscriptionId);
  if (!existing)
    throw new Error(
      "Subscription activation is not stored yet; retry required",
    );
  if (existing.last_webhook_event_id === event.id) return null;

  const subscription = await getPayPalSubscription(subscriptionId);
  if (
    subscription.id !== subscriptionId ||
    subscription.customId !== existing.user_id ||
    subscription.planId !== existing.paypal_plan_id
  ) {
    throw new Error("PayPal subscription identity mismatch");
  }
  return { existing, subscription };
}
