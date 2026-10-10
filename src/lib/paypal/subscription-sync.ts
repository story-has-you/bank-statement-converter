import "server-only";

import { findOpenBillingSubscription, updateBillingSubscriptionStatus } from "@/lib/billing/server";
import { getPayPalSubscription } from "@/lib/paypal/server";

/** 校准已有订阅的终态；同步失败时保留本地状态，供后续请求重试。 */
export async function syncPayPalSubscriptionStatus(userId: string): Promise<void> {
  try {
    const existing = await findOpenBillingSubscription(userId);
    if (!existing) return;

    const subscription = await getPayPalSubscription(existing.paypal_subscription_id);
    if (
      subscription.id !== existing.paypal_subscription_id ||
      subscription.customId !== userId ||
      subscription.planId !== existing.paypal_plan_id
    ) {
      console.error("PayPal subscription identity mismatch during status synchronization");
      return;
    }

    if (subscription.status !== "CANCELLED" && subscription.status !== "EXPIRED") return;
    await updateBillingSubscriptionStatus(existing, subscription.status);
  } catch {
    console.error("Failed to synchronize PayPal subscription status");
  }
}
