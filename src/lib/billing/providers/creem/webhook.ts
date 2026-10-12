import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { BillingError } from "@/lib/billing/errors";
import type { BillingEvent, BillingNotification } from "@/lib/billing/provider";
import { subscriptionConfig } from "@/config/plans";
import { getCreemWebhookSecret } from "./config";
import { createCreemClient, getCreemSubscription, isCreemId } from "./server";
import { normalizeCreemSubscription } from "./subscription";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Creem event evidence is incomplete");
  return value;
}

function reference(value: unknown): string {
  return typeof value === "string" ? value : string(object(value).id);
}

export async function parseCreemWebhook(headers: Headers, body: string): Promise<BillingNotification | null> {
  const signature = headers.get("creem-signature");
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) throw new BillingError("webhookSignatureFailed", 400);
  const secret = getCreemWebhookSecret();
  if (!secret) throw new BillingError("configurationMissing", 503);
  const expected = createHmac("sha256", secret).update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
    throw new BillingError("webhookSignatureFailed", 400);
  }
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new BillingError("webhookInvalidRequest", 400); }
  const envelope = object(value);
  if (!Object.keys(envelope).length) throw new BillingError("webhookInvalidRequest", 400);
  const types: Record<string, BillingEvent["type"]> = {
    "subscription.paid": "subscription-paid", "subscription.scheduled_cancel": "subscription-cancelled",
    "subscription.canceled": "subscription-cancelled", "subscription.past_due": "subscription-status-changed",
    "subscription.unpaid": "subscription-status-changed", "subscription.paused": "subscription-status-changed",
    "subscription.expired": "subscription-status-changed", "subscription.update": "subscription-status-changed",
  };
  const type = typeof envelope.eventType === "string" && Object.hasOwn(types, envelope.eventType) ? types[envelope.eventType] : undefined;
  if (!type) return null;
  const resource = object(envelope.object);
  const id = envelope.id;
  const subscriptionId = resource.id;
  const eventTime = envelope.created_at;
  if (typeof id !== "string" || !id || !isCreemId(subscriptionId, "sub") || typeof eventTime !== "number" || !Number.isFinite(new Date(eventTime).valueOf())) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  const at = new Date(eventTime).toISOString();
  return {
    provider: "creem", id, at, type, subscriptionId,
    resolve: () => resolveCreemEvent(type, id, at, subscriptionId, resource),
  };
}

async function resolveCreemEvent(
  type: BillingEvent["type"], id: string, at: string,
  subscriptionId: string, resource: Record<string, unknown>,
): Promise<BillingEvent> {
  const remote = await getCreemSubscription(subscriptionId);
  const subscription = normalizeCreemSubscription(remote);
  if (
    reference(resource.product) !== subscription.planId ||
    reference(resource.customer) !== subscription.payerId ||
    object(resource.metadata).referenceId !== subscription.userId
  ) throw new Error("Creem webhook subscription identity mismatch");
  const base = { provider: "creem" as const, id, at, subscription };
  if (type === "subscription-cancelled") {
    if (subscription.status !== "CANCELLED") throw new Error("Creem cancellation is not confirmed");
    return { ...base, type };
  }
  if (type === "subscription-status-changed") return { ...base, type };
  if (type !== "subscription-paid") throw new Error("Unsupported Creem event");
  // 已到期或暂停的迟到付款只核对身份，不允许恢复权益。
  if (["EXPIRED", "SUSPENDED"].includes(subscription.status)) {
    return { ...base, type, amount: "0", currencyCode: "USD", paidAt: at };
  }
  const transactionId = string(resource.last_transaction_id);
  if (remote.lastTransactionId !== transactionId) throw new Error("Creem payment evidence changed; retry required");
  const transaction = await createCreemClient().transactions.getById(transactionId);
  const paidCents = transaction.amountPaid ?? transaction.amount + (transaction.taxAmount ?? 0);
  if (
    transaction.id !== transactionId || transaction.status !== "paid" ||
    transaction.subscription !== subscriptionId || transaction.customer !== subscription.payerId ||
    transaction.currency !== "USD" || !Number.isSafeInteger(paidCents) ||
    paidCents !== Math.round(subscriptionConfig[subscription.tier].monthlyPrice * 100)
  ) throw new Error("Creem payment evidence is invalid");
  const start = Date.parse(subscription.periodStart ?? "");
  const end = Date.parse(subscription.periodEnd ?? "");
  const paidAt = transaction.createdAt;
  if (
    !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(paidAt) ||
    start >= end || paidAt < start || paidAt >= end || paidAt > Date.now() ||
    (transaction.periodStart !== undefined && transaction.periodStart !== start) ||
    (transaction.periodEnd !== undefined && transaction.periodEnd !== end)
  ) throw new Error("Creem paid billing period is invalid");
  return { ...base, type, amount: (paidCents / 100).toFixed(2), currencyCode: transaction.currency, paidAt: new Date(paidAt).toISOString() };
}
