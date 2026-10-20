import "server-only";

import { BillingError, type BillingErrorCode } from "./errors";
import {
  findCheckoutIntent,
  reserveCheckoutIntent,
  replaceCheckoutIntent,
  updateCheckoutIntent,
  type CheckoutIntent,
} from "./checkout-intents";
import type { CheckoutResult, CheckoutUser, CreatedCheckout, PaymentProvider } from "./provider";
import { getPaymentProvider, isPaymentProviderEnabled } from "./providers";
import {
  findBillingSubscriptionByProviderId,
  findEntitledBillingSubscription,
  findOpenBillingSubscription,
  type BillingSubscription,
} from "./server";
import { requireConfiguredProvider } from "./subscriptions";
import type { MembershipTier } from "./types";

function checkoutConflict(code: BillingErrorCode, intent: CheckoutIntent): BillingError {
  return new BillingError(code, 409, { provider: intent.provider, tier: intent.tier });
}

async function requirePurchaseEligibility(userId: string): Promise<void> {
  const open = await findOpenBillingSubscription(userId);
  if (open) {
    const codes = {
      ACTIVE: "existingActiveSubscription",
      PAYMENT_FAILED: "existingFailedSubscription",
      SUSPENDED: "existingSuspendedSubscription",
    } as const;
    const code = Object.hasOwn(codes, open.status) ? codes[open.status as keyof typeof codes] : "existingPendingSubscription";
    throw new BillingError(code, 409);
  }
  const entitled = await findEntitledBillingSubscription(userId);
  if (entitled?.status === "CANCELLED") {
    throw new BillingError("cancelledPeriodActive", 409);
  }
}

function checkoutChanges(checkout: CreatedCheckout) {
  return { checkout_id: checkout.checkoutId, checkout_url: checkout.checkoutUrl, expires_at: checkout.expiresAt };
}

async function createOwnedCheckout(
  intent: CheckoutIntent,
  provider: PaymentProvider,
  user: CheckoutUser,
  returnUrl: string,
): Promise<CheckoutResult> {
  let dispatched = false;
  let checkout: CreatedCheckout | undefined;
  try {
    // 取得占位后再读资格，避免旧快照跨越付款落库及占位轮换。
    await requirePurchaseEligibility(user.id);
    checkout = await provider.createCheckout(intent.tier, user, returnUrl, {
      id: intent.attempt_id,
      onDispatch: () => {
        dispatched = true;
      },
    });
    const saved = await updateCheckoutIntent(intent, { status: "READY", ...checkoutChanges(checkout) });
    if (!saved) {
      throw new Error("Checkout intent changed before checkout was saved");
    }
    return { provider: checkout.provider, checkoutId: checkout.checkoutId, checkoutUrl: checkout.checkoutUrl };
  } catch (error) {
    // 已发出的创建请求可能成功，超时或写库失败不能重新开放账户。
    await updateCheckoutIntent(intent, {
      status: dispatched ? "UNKNOWN" : "CLOSED",
      ...(checkout ? checkoutChanges(checkout) : {}),
    });
    if (dispatched) {
      throw checkoutConflict("checkoutUnknown", intent);
    }
    throw error;
  }
}

async function reconcileCheckout(intent: CheckoutIntent): Promise<CheckoutIntent> {
  if (intent.status === "COMPLETED" || intent.status === "CLOSED") {
    return intent;
  }
  if (intent.status === "CREATING") {
    throw checkoutConflict("checkoutCreating", intent);
  }
  if (!intent.checkout_id) {
    throw checkoutConflict("checkoutUnknown", intent);
  }
  const provider = getPaymentProvider(intent.provider);
  let state;
  try {
    state = await provider.resolveCheckout(intent.checkout_id, intent.tier, intent.user_id, intent.expires_at);
  } catch {
    throw checkoutConflict("checkoutUnknown", intent);
  }
  if (state.status === "completed") {
    const stored = await findBillingSubscriptionByProviderId(intent.provider, state.subscriptionId);
    if (
      !stored ||
      stored.user_id !== intent.user_id ||
      stored.tier !== intent.tier ||
      stored.provider_plan_id !== intent.provider_plan_id
    ) {
      throw checkoutConflict("checkoutAwaitingPayment", intent);
    }
    const completed = await updateCheckoutIntent(intent, { status: "COMPLETED" });
    if (!completed) {
      throw checkoutConflict("checkoutCreating", intent);
    }
    return completed;
  }
  if (state.status === "closed") {
    const closed = await updateCheckoutIntent(intent, { status: "CLOSED" });
    if (!closed) {
      throw checkoutConflict("checkoutCreating", intent);
    }
    return closed;
  }
  if (state.status === "processing") {
    throw checkoutConflict("checkoutAwaitingPayment", intent);
  }
  if (state.status === "unknown" || (intent.expires_at && Date.parse(intent.expires_at) <= Date.now()) || !intent.checkout_url) {
    throw checkoutConflict("checkoutUnknown", intent);
  }
  if (intent.status === "UNKNOWN") {
    const ready = await updateCheckoutIntent(intent, { status: "READY" });
    if (!ready) {
      throw checkoutConflict("checkoutCreating", intent);
    }
    return ready;
  }
  return intent;
}

export async function createSubscription(
  provider: PaymentProvider,
  tier: MembershipTier,
  user: CheckoutUser,
  returnUrl: string,
): Promise<CheckoutResult> {
  if (!isPaymentProviderEnabled(provider.id)) {
    throw new BillingError("paymentDisabled", 503);
  }
  requireConfiguredProvider(provider, tier);
  const selection = { user_id: user.id, provider: provider.id, tier, provider_plan_id: provider.getPlanId(tier)! };
  const reserved = await reserveCheckoutIntent(selection);
  if (reserved.owned) {
    return createOwnedCheckout(reserved.intent, provider, user, returnUrl);
  }
  await requirePurchaseEligibility(user.id);
  const intent = await reconcileCheckout(reserved.intent);
  if (intent.status === "COMPLETED" || intent.status === "CLOSED") {
    const replacement = await replaceCheckoutIntent(intent, selection);
    if (!replacement) {
      throw checkoutConflict("checkoutCreating", intent);
    }
    return createOwnedCheckout(replacement, provider, user, returnUrl);
  }
  if (intent.provider !== provider.id || intent.tier !== tier || intent.provider_plan_id !== selection.provider_plan_id) {
    throw checkoutConflict("checkoutAlreadyPending", intent);
  }
  return { provider: intent.provider, checkoutId: intent.checkout_id!, checkoutUrl: intent.checkout_url! };
}

/** 已付款订阅先落库，再完成与其结账引用匹配的占位；重复回调也可修复中断的收尾。 */
export async function completePaidCheckoutIntent(subscription: BillingSubscription): Promise<void> {
  const intent = await findCheckoutIntent(subscription.user_id);
  if (!intent?.checkout_id || intent.status === "COMPLETED" || intent.status === "CLOSED") {
    return;
  }
  if (
    intent.provider !== subscription.provider ||
    intent.tier !== subscription.tier ||
    intent.provider_plan_id !== subscription.provider_plan_id
  ) {
    return;
  }
  const state = await getPaymentProvider(intent.provider).resolveCheckout(
    intent.checkout_id,
    intent.tier,
    intent.user_id,
    intent.expires_at,
  );
  if (state.status === "completed" && state.subscriptionId === subscription.provider_subscription_id) {
    await updateCheckoutIntent(intent, { status: "COMPLETED" });
  }
}
