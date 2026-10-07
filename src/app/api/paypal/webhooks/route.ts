import { NextResponse } from "next/server";

import { applyBillingWebhook } from "@/lib/billing/server";
import { getPayPalSubscription, verifyPayPalWebhookSignature } from "@/lib/paypal/server";
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
    getString(resource.billing_agreement_id) ??
    getString(resource.subscription_id) ??
    getString(resource.id)
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
  const t = await getPayPalApiTranslations(request);
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
      console.warn("PayPal webhook signature verification failed");
      return NextResponse.json({ error: t("webhookSignatureFailed") }, { status: 400 });
    }

    const eventId = getString(payload.id);
    const eventType = getString(payload.event_type);
    const resource = getResourceObject(payload.resource);
    const subscriptionId = eventType?.startsWith("PAYMENT.SALE.")
      ? getString(resource.billing_agreement_id) ?? getString(resource.subscription_id)
      : getSubscriptionId(resource);
    const status = eventType ? getWebhookStatus(eventType, resource) : null;

    if (!eventId || !eventType || !subscriptionId || !status) {
      console.info("PayPal webhook ignored", { eventId, eventType, reason: "unsupported_or_incomplete" });
      return NextResponse.json({ received: true });
    }

    const eventAt = payload.create_time ?? new Date().toISOString();
    const authoritative = await getPayPalSubscription(subscriptionId);
    const billingInfo = authoritative.billingInfo;
    const subscriber = authoritative.subscriber;
    const result = await applyBillingWebhook({
      eventId,
      eventAt,
      subscriptionId,
      status: authoritative.status && isSubscriptionStatus(authoritative.status) ? authoritative.status : status,
      payerId: subscriber?.payerId ?? getString(getResourceObject(resource.subscriber).payer_id),
      subscriberEmail: subscriber?.emailAddress ?? getString(getResourceObject(resource.subscriber).email_address),
      currentPeriodStart: authoritative.startTime ?? getString(resource.start_time),
      currentPeriodEnd: billingInfo?.nextBillingTime ?? getString(getResourceObject(resource.billing_info).next_billing_time),
    });
    if (result === "not_found") {
      console.warn("PayPal webhook deferred", { eventId, eventType, reason: "subscription_not_found" });
      return NextResponse.json({ received: false }, { status: 409 });
    }

    console.info("PayPal webhook processed", { eventId, eventType, status, result });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process PayPal webhook", error);
    return NextResponse.json({ error: t("webhookProcessingFailed") }, { status: 502 });
  }
}
