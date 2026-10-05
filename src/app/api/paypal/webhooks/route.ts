import { NextResponse } from "next/server";

import {
  findBillingSubscriptionByPayPalId,
  upsertBillingSubscription,
} from "@/lib/billing/server";
import { verifyPayPalWebhookSignature } from "@/lib/paypal/server";
import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { isSubscriptionStatus, type SubscriptionStatus } from "@/lib/billing/types";

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

function getSubscriptionId(resource: Record<string, unknown>): string | null {
  return (
    getString(resource.id) ??
    getString(resource.subscription_id) ??
    getString(resource.billing_agreement_id)
  );
}

function getResourceObject(resource: unknown): Record<string, unknown> {
  return typeof resource === "object" && resource !== null
    ? (resource as Record<string, unknown>)
    : {};
}

function getWebhookStatus(eventType: string, resource: Record<string, unknown>): SubscriptionStatus | null {
  const resourceStatus = getString(resource.status);
  if (eventType === "BILLING.SUBSCRIPTION.UPDATED" && isSubscriptionStatus(resourceStatus)) {
    return resourceStatus;
  }

  const eventStatuses: Record<string, SubscriptionStatus> = {
    "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
    "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
    "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
    "BILLING.SUBSCRIPTION.EXPIRED": "EXPIRED",
    "PAYMENT.SALE.COMPLETED": "ACTIVE",
    "PAYMENT.SALE.DENIED": "PAYMENT_FAILED",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "PAYMENT_FAILED",
  };

  return eventStatuses[eventType] ?? null;
}

export async function POST(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations();
  const rawBody = await request.text();
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: t("webhookInvalidRequest") }, { status: 400 });
  }

  if (!isWebhookPayload(payload)) {
    return NextResponse.json({ error: t("webhookInvalidRequest") }, { status: 400 });
  }

  try {
    const verified = await verifyPayPalWebhookSignature(request.headers, payload);
    if (!verified) {
      return NextResponse.json({ error: t("webhookSignatureFailed") }, { status: 400 });
    }

    const eventId = getString(payload.id);
    const eventType = getString(payload.event_type);
    const resource = getResourceObject(payload.resource);
    const subscriptionId = getSubscriptionId(resource);
    const status = eventType ? getWebhookStatus(eventType, resource) : null;

    if (!eventId || !eventType || !subscriptionId || !status) {
      return NextResponse.json({ received: true });
    }

    const existing = await findBillingSubscriptionByPayPalId(subscriptionId);
    if (!existing || existing.last_webhook_event_id === eventId) {
      return NextResponse.json({ received: true });
    }

    const billingInfo = getResourceObject(resource.billing_info);
    const subscriber = getResourceObject(resource.subscriber);
    const resourceEmail = getString(subscriber.email_address);
    const resourcePayerId = getString(subscriber.payer_id);
    const nextBillingTime = getString(billingInfo.next_billing_time);

    await upsertBillingSubscription({
      ...existing,
      status,
      payer_id: resourcePayerId ?? existing.payer_id,
      subscriber_email: resourceEmail ?? existing.subscriber_email,
      current_period_end: nextBillingTime ?? existing.current_period_end,
      last_webhook_event_id: eventId,
      last_event_at: payload.create_time ?? new Date().toISOString(),
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process PayPal webhook", error);
    return NextResponse.json({ error: t("webhookProcessingFailed") }, { status: 502 });
  }
}
