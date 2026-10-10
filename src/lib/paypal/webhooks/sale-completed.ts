import { updateBillingSubscriptionFromWebhook } from "@/lib/billing/server";
import {
  getObject,
  getString,
  getWebhookEvent,
  requireTime,
  type WebhookPayload,
  type WebhookResult,
} from "@/lib/paypal/webhooks/shared";
import { getVerifiedSubscription } from "@/lib/paypal/webhooks/subscription";

export async function handleSaleCompleted(payload: WebhookPayload): Promise<WebhookResult> {
  const resource = getObject(payload.resource);
  // 同一个 PayPal 应用还可能产生与订阅无关的销售事件。
  if (!getString(resource.billing_agreement_id)) return "ignored";

  const event = getWebhookEvent(payload);
  const verified = await getVerifiedSubscription(resource.billing_agreement_id, event);
  if (!verified) return "ignored";

  const { existing, subscription } = verified;
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
