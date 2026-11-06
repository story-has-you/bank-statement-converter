import "server-only";

import { readCheckoutQuote } from "./checkout-quote";
import type { CheckoutQuoteIdentity } from "./checkout-quote";
import { findCheckoutIntent } from "./checkout-intents";
import type { PaymentProviderId, ProviderSubscription } from "./provider";
import { findBillingSubscriptionByProviderId } from "./server";
import { checkSubscriptionIdentity } from "./subscriptions";
import { requireRecurringAmount } from "./usd";

/** A current product price is never evidence of an older subscription's agreed price. */
export async function getLockedSubscriptionAmount(
  provider: PaymentProviderId,
  remote: ProviderSubscription,
  attemptId: string,
  evidence?: { metadata: string | null; storeId: string; environment: CheckoutQuoteIdentity["environment"] },
): Promise<string> {
  const signedAmount = evidence ? readCheckoutQuote(evidence.metadata, {
    attemptId, userId: remote.userId, tier: remote.tier, productId: remote.planId,
    storeId: evidence.storeId, environment: evidence.environment,
  }) : null;
  const existing = await findBillingSubscriptionByProviderId(provider, remote.subscriptionId);
  if (existing) {
    checkSubscriptionIdentity(existing, remote);
    const amount = requireRecurringAmount(existing.recurring_amount_usd);
    if (signedAmount !== null && amount !== signedAmount) throw new Error("Subscription agreed price mismatch");
    return amount;
  }
  if (signedAmount !== null) return signedAmount;
  const intent = await findCheckoutIntent(remote.userId, attemptId);
  if (
    !intent || intent.provider !== provider || intent.tier !== remote.tier || intent.provider_plan_id !== remote.planId ||
    intent.status === "CLOSED" || intent.status === "COMPLETED" ||
    intent.attempt_id !== attemptId ||
    (intent.checkout_id !== null && intent.checkout_id !== `wco_${attemptId}`)
  ) {
    throw new Error("Subscription has no matching checkout price");
  }
  return requireRecurringAmount(intent.quoted_amount_usd);
}
