import { NextResponse } from "next/server";

import { applyBillingWebhook } from "@/lib/billing/server";
import { getPayPalPlans } from "@/lib/paypal/config";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { getPayPalSubscription, verifyPayPalWebhookSignature } from "@/lib/paypal/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookPayload = {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource?: Record<string, unknown>;
};

function isWebhookPayload(value: unknown): value is WebhookPayload {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasCurrentPeriod(start: string | undefined, end: string | undefined): boolean {
  if (!start || !end) return false;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime < endTime && endTime > Date.now();
}

export async function POST(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations(request);
  let payload: unknown;

  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: t("webhookInvalidRequest") }, { status: 400 });
  }

  if (!isWebhookPayload(payload)) {
    return NextResponse.json({ error: t("webhookInvalidRequest") }, { status: 400 });
  }

  try {
    if (!(await verifyPayPalWebhookSignature(request.headers, payload))) {
      console.warn("PayPal webhook signature verification failed");
      return NextResponse.json({ error: t("webhookSignatureFailed") }, { status: 400 });
    }

    if (payload.event_type !== "BILLING.SUBSCRIPTION.ACTIVATED") {
      return NextResponse.json({ received: true });
    }

    const resource = getObject(payload.resource);
    const eventId = getString(payload.id);
    const eventAt = getString(payload.create_time);
    const subscriptionId = getString(resource.id);
    const userId = getString(resource.custom_id);
    const planId = getString(resource.plan_id);
    const payment = getObject(getObject(getObject(resource.billing_info).last_payment).amount);
    const amount = getString(payment.value);
    const currencyCode = getString(payment.currency_code);
    const amountValid = amount !== null && /^\d{1,12}(?:\.\d{1,6})?$/.test(amount) && Number(amount) > 0;

    if (
      !eventId || !eventAt || !Number.isFinite(Date.parse(eventAt)) ||
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

    const result = await applyBillingWebhook({
      eventId,
      eventAt,
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

    console.info("PayPal activation processed", { eventId, subscriptionId, result });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process PayPal activation", error);
    return NextResponse.json({ error: t("webhookProcessingFailed") }, { status: 502 });
  }
}
