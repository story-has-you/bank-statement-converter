import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { usdFromDecimal, usdFromMinorUnits, usdToDecimal } from "@/lib/billing/usd";
import { BillingError } from "@/lib/billing/errors";
import type { BillingEvent, BillingNotification } from "@/lib/billing/provider";
import { subscriptionConfig } from "@/config/plans";
import { getCreemEnvironment, getCreemWebhookSecret } from "./config";
import { createCreemClient, getCreemSubscription, isCreemId } from "./server";
import { normalizeCreemSubscription } from "./subscription";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function string(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Creem event evidence is incomplete");
  }
  return value;
}

function reference(value: unknown): string {
  return typeof value === "string" ? value : string(object(value).id);
}

export async function parseCreemWebhook(headers: Headers, body: string): Promise<BillingNotification | null> {
  const signature = headers.get("creem-signature");
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw new BillingError("webhookSignatureFailed", 400);
  }
  const secret = getCreemWebhookSecret();
  if (!secret) {
    throw new BillingError("configurationMissing", 503);
  }
  const expected = createHmac("sha256", secret).update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
    throw new BillingError("webhookSignatureFailed", 400);
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  const envelope = object(value);
  if (!Object.keys(envelope).length) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  const types: Record<string, BillingEvent["type"]> = {
    "subscription.paid": "subscription-paid",
    "subscription.scheduled_cancel": "subscription-cancelled",
    "subscription.canceled": "subscription-cancelled",
    "subscription.past_due": "subscription-status-changed",
    "subscription.unpaid": "subscription-status-changed",
    "subscription.paused": "subscription-status-changed",
    "subscription.expired": "subscription-status-changed",
    "subscription.update": "subscription-status-changed",
  };
  const type = typeof envelope.eventType === "string" && Object.hasOwn(types, envelope.eventType) ? types[envelope.eventType] : undefined;
  if (!type) {
    return null;
  }
  const resource = object(envelope.object);
  const id = envelope.id;
  const subscriptionId = resource.id;
  const eventTime = envelope.created_at;
  if (
    typeof id !== "string" ||
    !id ||
    !isCreemId(subscriptionId, "sub") ||
    typeof eventTime !== "number" ||
    !Number.isFinite(new Date(eventTime).valueOf())
  ) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  const at = new Date(eventTime).toISOString();
  return { provider: "creem", id, at, type, subscriptionId, resolve: () => resolveCreemEvent(type, id, at, subscriptionId, resource) };
}

async function resolveCreemEvent(
  type: BillingEvent["type"],
  id: string,
  at: string,
  subscriptionId: string,
  resource: Record<string, unknown>,
): Promise<BillingEvent> {
  const remote = await getCreemSubscription(subscriptionId);
  const mode = getCreemEnvironment() === "production" ? "prod" : "test";
  if (remote.mode !== mode || resource.mode !== mode) {
    throw new Error("Creem webhook environment mismatch");
  }
  const subscription = normalizeCreemSubscription(remote);
  if (
    reference(resource.product) !== subscription.planId ||
    reference(resource.customer) !== subscription.payerId ||
    object(resource.metadata).referenceId !== subscription.userId
  ) {
    throw new Error("Creem webhook subscription identity mismatch");
  }
  const base = { provider: "creem" as const, id, at, subscription };
  if (type === "subscription-cancelled") {
    if (subscription.status !== "CANCELLED") {
      throw new Error("Creem cancellation is not confirmed");
    }
    return { ...base, type };
  }
  if (type === "subscription-status-changed") {
    return { ...base, type };
  }
  if (type !== "subscription-paid") {
    throw new Error("Unsupported Creem event");
  }
  // 已到期或暂停的迟到付款只核对身份，不允许恢复权益。
  if (["EXPIRED", "SUSPENDED"].includes(subscription.status)) {
    return {
      ...base,
      type,
      amount: "0",
      originalAmount: "0",
      discountAmount: "0",
      providerDiscountId: null,
      currencyCode: "USD",
      paidAt: at,
    };
  }
  const transactionId = string(resource.last_transaction_id);
  if (remote.lastTransactionId !== transactionId) {
    throw new Error("Creem payment evidence changed; retry required");
  }
  const transaction = await createCreemClient().transactions.getById(transactionId);
  // 套餐价已含税；折扣交易必须使用渠道明确返回的实付金额。
  const originalCents = usdFromDecimal(String(subscriptionConfig[subscription.tier].monthlyPrice));
  // Creem 的 100% 优惠券交易可能返回 discountAmount=0，只在完整全额抵扣证据下补齐优惠快照。
  const fullyDiscounted =
    transaction.amountPaid === 0 &&
    (transaction.discountAmount ?? 0) === 0 &&
    usdFromMinorUnits(transaction.amount) === originalCents &&
    remote.discount?.type === "percentage" &&
    remote.discount.amount === 100 &&
    typeof remote.product !== "string" &&
    usdFromMinorUnits(remote.product.price) === originalCents &&
    remote.product.currency === "USD" &&
    remote.product.taxMode === "inclusive";
  const discountCents = fullyDiscounted ? originalCents : usdFromMinorUnits(transaction.discountAmount ?? 0);
  const paidCents = usdFromMinorUnits(transaction.amountPaid ?? transaction.amount);
  const providerDiscountId = discountCents > 0 ? remote.discount?.id?.trim() || null : null;
  if (
    transaction.id !== transactionId ||
    transaction.mode !== mode ||
    transaction.status !== "paid" ||
    transaction.subscription !== subscriptionId ||
    transaction.customer !== subscription.payerId ||
    transaction.currency !== "USD" ||
    discountCents > originalCents ||
    paidCents + discountCents !== originalCents ||
    (remote.discount !== undefined && transaction.amountPaid == null) ||
    (discountCents > 0 && (transaction.amountPaid == null || !providerDiscountId))
  ) {
    throw new Error("Creem payment evidence is invalid");
  }
  const start = Date.parse(subscription.periodStart ?? "");
  const end = Date.parse(subscription.periodEnd ?? "");
  const paidAt = transaction.createdAt;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(paidAt) ||
    start >= end ||
    paidAt < start ||
    paidAt >= end ||
    paidAt > Date.now() ||
    (transaction.periodStart !== undefined && transaction.periodStart !== start) ||
    (transaction.periodEnd !== undefined && transaction.periodEnd !== end)
  ) {
    throw new Error("Creem paid billing period is invalid");
  }
  return {
    ...base,
    type,
    amount: usdToDecimal(paidCents),
    originalAmount: usdToDecimal(originalCents),
    discountAmount: usdToDecimal(discountCents),
    providerDiscountId,
    currencyCode: transaction.currency,
    paidAt: new Date(paidAt).toISOString(),
  };
}
