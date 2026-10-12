import "server-only";

import { BillingError } from "@/lib/billing/errors";
import type { BillingEvent, BillingNotification } from "@/lib/billing/provider";

import { normalizeSubscription } from "./subscription";
import { getPayPalSubscription, verifyPayPalWebhookSignature } from "./server";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("PayPal event evidence is incomplete");
  return value;
}

function time(value: unknown): string {
  const result = string(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error("PayPal event time is invalid");
  return result;
}

/** 先验签和解析，再按需核实远端证据；重复事件无需再次查询渠道，不访问本地记录。 */
export async function parsePayPalWebhook(headers: Headers, body: string): Promise<BillingNotification | null> {
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { throw new BillingError("webhookInvalidRequest", 400); }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new BillingError("webhookInvalidRequest", 400);
  }
  if (!await verifyPayPalWebhookSignature(headers, payload)) {
    throw new BillingError("webhookSignatureFailed", 400);
  }
  const envelope = object(payload);
  const types = {
    "BILLING.SUBSCRIPTION.ACTIVATED": "subscription-activated",
    "BILLING.SUBSCRIPTION.CANCELLED": "subscription-cancelled",
    "PAYMENT.SALE.COMPLETED": "subscription-renewed",
  } as const;
  const eventType = envelope.event_type;
  if (typeof eventType !== "string" || !Object.hasOwn(types, eventType)) return null;
  const type = types[eventType as keyof typeof types];
  const resource = object(envelope.resource);
  if (type === "subscription-renewed" && !resource.billing_agreement_id) return null;
  const id = string(envelope.id);
  const at = time(envelope.create_time);
  const subscriptionId = string(type === "subscription-renewed" ? resource.billing_agreement_id : resource.id);
  return {
    provider: "paypal", id, at, type, subscriptionId,
    resolve: () => resolvePayPalEvent(type, id, at, subscriptionId, resource),
  };
}

async function resolvePayPalEvent(
  type: BillingEvent["type"], id: string, at: string,
  subscriptionId: string, resource: Record<string, unknown>,
): Promise<BillingEvent> {
  const remote = await getPayPalSubscription(subscriptionId);
  const subscription = normalizeSubscription(remote);
  if (subscription.subscriptionId !== subscriptionId) throw new Error("PayPal subscription ID mismatch");
  const base = { provider: "paypal" as const, id, at, subscription };

  if (type === "subscription-activated") {
    const amount = object(object(object(resource.billing_info).last_payment).amount);
    const value = string(amount.value);
    const currencyCode = string(amount.currency_code);
    if (
      !/^\d{1,12}(?:\.\d{1,6})?$/.test(value) || Number(value) <= 0 || !/^[A-Z]{3}$/.test(currencyCode) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(string(resource.custom_id)) ||
      subscription.userId !== resource.custom_id || subscription.planId !== resource.plan_id ||
      subscription.status !== "ACTIVE"
    ) throw new Error("PayPal activation does not match the current subscription");
    return { ...base, type, amount: value, currencyCode };
  }
  if (type === "subscription-cancelled") {
    if (subscription.status !== "CANCELLED") throw new Error("PayPal cancellation is not confirmed yet");
    return { ...base, type };
  }
  // 已取消等终态的付款不再需要验证账期证据；计费模块仍负责核对本地身份。
  if (subscription.status !== "ACTIVE") return { ...base, type, saleAt: null, paidAt: null };
  const saleAt = time(resource.create_time);
  const payment = remote.billingInfo?.lastPayment;
  const paidAt = time(payment?.time);
  const end = time(subscription.periodEnd);
  const amount = object(resource.amount);
  if (
    resource.state !== "completed" || typeof amount.total !== "string" ||
    !Number.isFinite(Number(amount.total)) || Number(amount.total) <= 0 ||
    typeof amount.currency !== "string" || !/^[A-Z]{3}$/.test(amount.currency) ||
    !payment?.amount?.value || !Number.isFinite(Number(payment.amount.value)) || Number(payment.amount.value) <= 0 ||
    payment.amount.currencyCode !== amount.currency ||
    (Date.parse(paidAt) === Date.parse(saleAt) && Number(payment.amount.value) !== Number(amount.total))
  ) throw new Error("PayPal subscription payment evidence is incomplete");
  if (Date.parse(paidAt) < Date.parse(saleAt) || Date.parse(end) <= Date.parse(paidAt)) {
    throw new Error("PayPal billing period is not ready; retry required");
  }
  return { ...base, type, saleAt, paidAt };
}
