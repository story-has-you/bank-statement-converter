import "server-only";

import { randomUUID } from "node:crypto";
import { Creem } from "creem";
import type { SubscriptionEntity } from "creem/models/components";
import { BillingError } from "@/lib/billing/errors";
import type { CheckoutUser, CheckoutResult } from "@/lib/billing/provider";
import type { MembershipTier } from "@/lib/billing/types";
import { getCreemConfig, getCreemProductId } from "./config";

export function createCreemClient(): Creem {
  const config = getCreemConfig();
  if (!config) throw new BillingError("configurationMissing", 503);
  return new Creem({ apiKey: config.apiKey, server: config.environment === "test" ? "test" : "prod", timeoutMs: 10_000, retryConfig: { strategy: "none" } });
}

export function isCreemId(value: unknown, prefix: "sub" | "ch"): value is string {
  return typeof value === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);
}

export async function createCreemCheckout(tier: MembershipTier, user: CheckoutUser, returnUrl: string): Promise<CheckoutResult> {
  const productId = getCreemProductId(tier);
  if (!productId) throw new BillingError("configurationMissing", 503);
  const checkout = await createCreemClient().checkouts.create({
    productId,
    units: 1,
    requestId: randomUUID(),
    successUrl: returnUrl,
    customer: { email: user.email },
    metadata: { referenceId: user.id, tier },
  });
  if (!isCreemId(checkout.id, "ch") || !checkout.checkoutUrl) throw new Error("Creem checkout response is incomplete");
  const url = new URL(checkout.checkoutUrl);
  if (url.protocol !== "https:" || !["creem.io", "www.creem.io", "test.creem.io"].includes(url.hostname)) throw new Error("Creem checkout URL is invalid");
  return { provider: "creem", checkoutId: checkout.id, checkoutUrl: url.href };
}

export async function resolveCreemCheckout(checkoutId: string, tier: MembershipTier, userId: string): Promise<string | null> {
  if (!isCreemId(checkoutId, "ch")) throw new BillingError("invalidRequest", 400);
  const checkout = await createCreemClient().checkouts.retrieve(checkoutId);
  if (checkout.id !== checkoutId || checkout.metadata?.referenceId !== userId) throw new BillingError("subscriptionBelongsToAnotherAccount", 409);
  const productId = typeof checkout.product === "string" ? checkout.product : checkout.product.id;
  if (productId !== getCreemProductId(tier) || checkout.metadata?.tier !== tier || checkout.units !== 1) throw new BillingError("planMismatch", 409);
  if (checkout.status !== "completed" || !checkout.subscription) return null;
  const subscriptionId = typeof checkout.subscription === "string" ? checkout.subscription : checkout.subscription.id;
  if (!isCreemId(subscriptionId, "sub")) throw new Error("Creem checkout subscription is invalid");
  return subscriptionId;
}

export async function getCreemSubscription(id: string): Promise<SubscriptionEntity> {
  const subscription = await createCreemClient().subscriptions.get(id);
  if (subscription.id !== id) throw new Error("Creem subscription ID mismatch");
  return subscription;
}

export async function cancelCreemSubscription(id: string): Promise<void> {
  const subscription = await createCreemClient().subscriptions.cancel(id, { mode: "scheduled" });
  if (subscription.id !== id || !["scheduled_cancel", "canceled"].includes(subscription.status)) throw new Error("Creem cancellation is not confirmed");
}
