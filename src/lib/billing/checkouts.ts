import "server-only";

import { subscriptionConfig } from "@/config/plans";
import { requireRecurringAmount } from "./usd";

import { BillingError } from "./errors";
import { randomUUID } from "node:crypto";
import type { CheckoutResult, CheckoutUser, PaymentProvider } from "./provider";
import { isPaymentProviderEnabled } from "./providers";
import {
  findEntitledBillingSubscription,
  findOpenBillingSubscription,
} from "./server";
import { requireConfiguredProvider } from "./subscriptions";
import type { MembershipTier } from "./types";

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
  await requirePurchaseEligibility(user.id);
  const checkout = await provider.createCheckout(tier, user, returnUrl, {
    id: randomUUID(),
    amount: requireRecurringAmount(subscriptionConfig[tier].monthlyPrice),
  });
  return { provider: checkout.provider, checkoutId: checkout.checkoutId, checkoutUrl: checkout.checkoutUrl };
}
