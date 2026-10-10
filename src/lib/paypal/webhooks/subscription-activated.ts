import { applyBillingWebhook } from "@/lib/billing/server";
import { getPayPalPlans } from "@/lib/paypal/config";
import { getPayPalSubscription } from "@/lib/paypal/server";
import {
  getObject,
  getString,
  getWebhookEvent,
  type WebhookPayload,
  type WebhookResult,
} from "@/lib/paypal/webhooks/shared";
import { createAdminClient } from "@/lib/supabase/admin";

function hasCurrentPeriod(start: string | undefined, end: string | undefined): boolean {
  if (!start || !end) return false;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime < endTime && endTime > Date.now();
}

export async function handleSubscriptionActivated(payload: WebhookPayload): Promise<WebhookResult> {
  const event = getWebhookEvent(payload);
  const resource = getObject(payload.resource);
  const subscriptionId = getString(resource.id);
  const userId = getString(resource.custom_id);
  const planId = getString(resource.plan_id);
  const payment = getObject(getObject(getObject(resource.billing_info).last_payment).amount);
  const amount = getString(payment.value);
  const currencyCode = getString(payment.currency_code);
  const amountValid = amount !== null && /^\d{1,12}(?:\.\d{1,6})?$/.test(amount) && Number(amount) > 0;

  if (
    !subscriptionId || !userId || !planId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    !amountValid || !currencyCode || !/^[A-Z]{3}$/.test(currencyCode)
  ) {
    throw new Error("PayPal activation event is incomplete");
  }

  const subscription = await getPayPalSubscription(subscriptionId);
  if (
    subscription.id !== subscriptionId || subscription.customId !== userId ||
    subscription.planId !== planId || subscription.status !== "ACTIVE" ||
    !hasCurrentPeriod(subscription.startTime, subscription.billingInfo?.nextBillingTime)
  ) {
    throw new Error("PayPal activation does not match the current subscription");
  }

  const plan = getPayPalPlans().find((candidate) => candidate.planId === planId);
  if (!plan) throw new Error("PayPal activation plan is not configured");

  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
  if (accountError) throw accountError;
  if (!account.user?.email) throw new Error("PayPal activation user has no account email");

  return applyBillingWebhook({
    eventId: event.id,
    eventAt: event.at,
    subscriptionId,
    userId,
    email: account.user.email,
    tier: plan.tier,
    planId,
    amount,
    currencyCode,
    payerId: subscription.subscriber?.payerId ?? null,
    subscriberEmail: subscription.subscriber?.emailAddress ?? null,
    currentPeriodStart: subscription.startTime!,
    currentPeriodEnd: subscription.billingInfo!.nextBillingTime!,
  });
}
