import "server-only";

import { subscriptionConfig } from "@/config/plans";
import { BillingError } from "@/lib/billing/errors";
import type { BillingEvent, BillingNotification } from "@/lib/billing/provider";
import { getPayPalPlan, getPayPalSubscription, getPayPalTransaction, isPayPalSubscriptionId, verifyPayPalWebhook } from "./server";
import { getPayPalPaidPeriod, normalizePayPalSubscription } from "./subscription";

type PayPalWebhook = {
  id: string;
  event_type: string;
  create_time: string;
  resource: {
    id: string;
    billing_agreement_id?: string;
    state?: string;
    create_time?: string;
    amount?: { total: string; currency: string };
  };
};

/** Verify notifications before resolving remote payment evidence; never write to Supabase. */
export async function parsePayPalWebhook(headers: Headers, body: string): Promise<BillingNotification | null> {
  let event: PayPalWebhook;
  try {
    event = JSON.parse(body) as PayPalWebhook;
  } catch {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  await verifyPayPalWebhook(headers, event);
  const types: Record<string, BillingEvent["type"]> = {
    "PAYMENT.SALE.COMPLETED": "subscription-paid",
    "BILLING.SUBSCRIPTION.CANCELLED": "subscription-cancelled",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "subscription-status-changed",
    "BILLING.SUBSCRIPTION.SUSPENDED": "subscription-status-changed",
    "BILLING.SUBSCRIPTION.EXPIRED": "subscription-status-changed",
  };
  if (!Object.hasOwn(types, event.event_type)) {
    return null;
  }
  const type = types[event.event_type];
  if (type === "subscription-paid" && !event.resource?.billing_agreement_id) {
    return null;
  }
  const subscriptionId = type === "subscription-paid" ? event.resource.billing_agreement_id : event.resource?.id;
  if (
    !isPayPalSubscriptionId(subscriptionId) ||
    typeof event.id !== "string" ||
    !event.id ||
    !Number.isFinite(Date.parse(event.create_time))
  ) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  return {
    provider: "paypal",
    id: event.id,
    at: event.create_time,
    type,
    subscriptionId,
    resolve: () => resolvePayPalEvent(event, type, subscriptionId),
  };
}

async function resolvePayPalEvent(event: PayPalWebhook, type: BillingEvent["type"], subscriptionId: string): Promise<BillingEvent> {
  const remote = await getPayPalSubscription(subscriptionId);
  const subscription = normalizePayPalSubscription(remote);
  const base = { provider: "paypal" as const, id: event.id, at: event.create_time, subscription };
  if (type === "subscription-cancelled") {
    if (subscription.status !== "CANCELLED") {
      throw new Error("PayPal cancellation is not confirmed");
    }
    return { ...base, type };
  }
  if (type === "subscription-status-changed") {
    return { ...base, type };
  }
  const sale = event.resource;
  if (sale.state !== "completed" || !sale.create_time || !Number.isFinite(Date.parse(sale.create_time))) {
    throw new Error("PayPal sale evidence is invalid");
  }
  await getPayPalPlan(subscription.tier);
  const transaction = await getPayPalTransaction(subscriptionId, sale.id, sale.create_time);
  const amount = transaction.amount_with_breakdown.gross_amount;
  const price = subscriptionConfig[subscription.tier].monthlyPrice;
  if (
    amount.currency_code !== "USD" ||
    Number(amount.value) !== price ||
    sale.amount?.currency !== amount.currency_code ||
    Number(sale.amount.total) !== price
  ) {
    throw new Error("PayPal payment evidence is invalid");
  }
  const period = getPayPalPaidPeriod(remote, transaction.time);
  return {
    ...base,
    subscription: { ...subscription, ...period },
    type: "subscription-paid",
    amount: amount.value,
    originalAmount: amount.value,
    discountAmount: "0",
    providerDiscountId: null,
    currencyCode: amount.currency_code,
    paidAt: transaction.time,
  };
}
