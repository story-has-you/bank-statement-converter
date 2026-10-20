import "server-only";

import { verifyWebhook, type WebhookEvent, type WebhookEventData } from "@waffo/pancake-ts";
import { usdFromDecimal } from "@/lib/billing/usd";
import { BillingError } from "@/lib/billing/errors";
import type { BillingEvent, BillingNotification } from "@/lib/billing/provider";
import { getWaffoCurrentPayment, getWaffoPayment, getWaffoSubscription, isWaffoOrderId, requireWaffoConfig } from "./server";
import { normalizeWaffoSubscription, verifyWaffoPayment } from "./subscription";

export async function parseWaffoWebhook(headers: Headers, body: string): Promise<BillingNotification | null> {
  const config = requireWaffoConfig();
  const signature = headers.get("x-waffo-signature");
  if (!signature) {
    throw new BillingError("webhookSignatureFailed", 400);
  }
  let event: WebhookEvent;
  try {
    event = verifyWebhook(body, signature, { environment: config.environment });
  } catch {
    throw new BillingError("webhookSignatureFailed", 400);
  }
  if (event.storeId !== config.storeId || event.mode !== config.environment) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  const types: Record<string, BillingEvent["type"]> = {
    "subscription.payment_succeeded": "subscription-paid",
    "subscription.canceling": "subscription-status-changed",
    "subscription.canceled": "subscription-status-changed",
    "subscription.past_due": "subscription-status-changed",
    "subscription.uncanceled": "subscription-resumed",
  };
  const type = Object.hasOwn(types, event.eventType) ? types[event.eventType] : undefined;
  if (!type) {
    return null;
  }
  if (!event.id || !isWaffoOrderId(event.data.orderId) || !Number.isFinite(Date.parse(event.timestamp))) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  return {
    provider: "waffo",
    id: event.id,
    at: event.timestamp,
    type,
    subscriptionId: event.data.orderId,
    resolve: () => resolveWaffoEvent(event, type),
  };
}

async function resolveWaffoEvent(event: WebhookEvent<WebhookEventData>, type: BillingEvent["type"]): Promise<BillingEvent> {
  const paymentId = event.data.paymentId;
  if (type === "subscription-paid" && (!paymentId || event.eventId !== paymentId)) {
    throw new Error("Waffo paid event has no matching payment ID");
  }
  const [remote, payment] = await Promise.all([
    getWaffoSubscription(event.data.orderId),
    type === "subscription-paid" ? getWaffoPayment(paymentId!) : null,
  ]);
  const subscription = normalizeWaffoSubscription(remote);
  if (
    event.data.merchantProvidedBuyerIdentity !== subscription.userId ||
    event.data.orderMerchantExternalId !== remote.orderMerchantExternalId
  ) {
    throw new Error("Waffo webhook subscription identity mismatch");
  }
  const base = { provider: "waffo" as const, id: event.id, at: event.timestamp, subscription };
  if (type === "subscription-status-changed") {
    return { ...base, type };
  }
  if (type === "subscription-resumed") {
    if (subscription.status === "ACTIVE") {
      verifyWaffoPayment(remote, await getWaffoCurrentPayment(remote));
    }
    return { ...base, type };
  }
  if (type !== "subscription-paid" || !payment) {
    throw new Error("Unsupported Waffo event");
  }
  const verified = verifyWaffoPayment(remote, payment);
  if (
    event.data.periodNumber !== payment.periodNumber ||
    event.data.currency !== "USD" ||
    event.data.chargedAmount === undefined ||
    usdFromDecimal(event.data.chargedAmount) !== usdFromDecimal(verified.amount) ||
    event.data.paymentStatus !== "succeeded"
  ) {
    throw new Error("Waffo webhook payment evidence mismatch");
  }
  return {
    ...base,
    type,
    ...verified,
    originalAmount: verified.amount,
    discountAmount: "0.00",
    providerDiscountId: null,
    currencyCode: "USD",
  };
}
