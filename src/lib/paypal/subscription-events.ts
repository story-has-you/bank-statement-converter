import {
  findBillingSubscriptionByPayPalId,
  updateBillingSubscriptionFromWebhook,
} from "@/lib/billing/server";
import { getPayPalSubscription } from "@/lib/paypal/server";

function requireString(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Subscription event is incomplete");
  return value;
}

function requireTime(value: unknown): number {
  const time = Date.parse(requireString(value));
  if (!Number.isFinite(time)) throw new Error("Subscription event time is invalid");
  return time;
}

export async function processSubscriptionLifecycleEvent(
  eventType: "BILLING.SUBSCRIPTION.CANCELLED" | "PAYMENT.SALE.COMPLETED",
  event: { id: string; at: string },
  resource: Record<string, unknown>,
): Promise<"applied" | "ignored"> {
  const subscriptionId = requireString(
    eventType === "PAYMENT.SALE.COMPLETED" ? resource.billing_agreement_id : resource.id,
  );
  const existing = await findBillingSubscriptionByPayPalId(subscriptionId);
  if (!existing) throw new Error("Subscription activation is not stored yet; retry required");
  if (existing.last_webhook_event_id === event.id) return "ignored";

  const subscription = await getPayPalSubscription(subscriptionId);
  if (
    subscription.id !== subscriptionId || subscription.customId !== existing.user_id ||
    subscription.planId !== existing.paypal_plan_id
  ) {
    throw new Error("PayPal subscription identity mismatch");
  }

  if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
    if (subscription.status !== "CANCELLED") throw new Error("PayPal cancellation is not confirmed yet");
    return updateBillingSubscriptionFromWebhook(existing, event, { status: "CANCELLED" });
  }

  // 迟到的付款事件不能恢复已取消的订阅，也不能创建首条订阅记录。
  if (existing.status !== "ACTIVE" || subscription.status !== "ACTIVE") return "ignored";
  if (existing.last_event_at && Date.parse(event.at) < Date.parse(existing.last_event_at)) return "ignored";

  const saleAt = requireTime(resource.create_time);
  const payment = subscription.billingInfo?.lastPayment;
  const paymentAt = requireTime(payment?.time);
  const nextBillingAt = requireTime(subscription.billingInfo?.nextBillingTime);
  const previousEnd = requireTime(existing.current_period_end);
  const amount = resource.amount as { total?: unknown; currency?: unknown } | undefined;
  if (
    resource.state !== "completed" || !amount || typeof amount.total !== "string" ||
    !Number.isFinite(Number(amount.total)) || Number(amount.total) <= 0 ||
    typeof amount.currency !== "string" || !/^[A-Z]{3}$/.test(amount.currency) ||
    !payment?.amount?.value || !Number.isFinite(Number(payment.amount.value)) ||
    Number(payment.amount.value) <= 0 || payment.amount.currencyCode !== amount.currency ||
    (paymentAt === saleAt && Number(payment.amount.value) !== Number(amount.total))
  ) {
    throw new Error("PayPal subscription payment evidence is incomplete");
  }

  if (paymentAt < saleAt || nextBillingAt <= paymentAt) {
    throw new Error("PayPal billing period is not ready; retry required");
  }
  if (nextBillingAt <= previousEnd) {
    if (saleAt >= previousEnd) throw new Error("PayPal renewed billing period is not ready; retry required");
    return "ignored";
  }
  if (nextBillingAt <= Date.now()) throw new Error("PayPal current billing period is unavailable");

  const periodStart = Math.max(previousEnd, paymentAt);
  if (periodStart >= nextBillingAt || periodStart > Date.now()) {
    throw new Error("PayPal renewed billing period is invalid");
  }
  return updateBillingSubscriptionFromWebhook(existing, event, {
    current_period_start: new Date(periodStart).toISOString(),
    current_period_end: new Date(nextBillingAt).toISOString(),
  });
}
