import { NextResponse } from "next/server";

import { applyBillingWebhook } from "@/lib/billing/server";
import { isSubscriptionStatus, type MembershipTier, type SubscriptionStatus } from "@/lib/billing/types";
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

function hasCurrentPeriod(start: string | undefined, end: string | undefined): boolean {
  if (!start || !end) return false;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  return (
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startTime < endTime &&
    endTime > Date.now()
  );
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
    const terminalEvent = status === "PAYMENT_FAILED" || status === "CANCELLED" || status === "EXPIRED";
    const authoritative = terminalEvent ? null : await getPayPalSubscription(subscriptionId);
    if (authoritative && authoritative.id !== subscriptionId) {
      throw new Error("PayPal returned a different subscription ID");
    }

    let userId: string | null = null;
    let email: string | null = null;
    let tier: MembershipTier | null = null;
    let planId: string | null = null;

    if (eventType === "PAYMENT.SALE.COMPLETED") {
      if (
        authoritative?.status !== "ACTIVE" ||
        !hasCurrentPeriod(authoritative.startTime, authoritative.billingInfo?.nextBillingTime)
      ) {
        throw new Error("Paid PayPal subscription is not yet active with a current billing period");
      }

      const plan = getPayPalPlans().find((candidate) => candidate.planId === authoritative.planId);
      const customId = authoritative.customId;
      const isUserId = customId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customId);
      if (!plan || !isUserId) {
        console.warn("PayPal webhook ignored", { eventId, eventType, reason: "unmatched_plan_or_account" });
        return NextResponse.json({ received: true });
      }

      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase admin configuration is incomplete");
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(customId);
      if (accountError) throw accountError;
      if (!account.user?.email) {
        console.warn("PayPal webhook ignored", { eventId, eventType, reason: "account_missing_email" });
        return NextResponse.json({ received: true });
      }

      userId = customId;
      email = account.user.email;
      tier = plan.tier;
      planId = plan.planId;
    }

    const billingInfo = authoritative?.billingInfo;
    const subscriber = authoritative?.subscriber;
    const result = await applyBillingWebhook({
      eventId,
      eventAt,
      eventType,
      subscriptionId,
      status,
      payerId: subscriber?.payerId ?? getString(getResourceObject(resource.subscriber).payer_id),
      subscriberEmail: subscriber?.emailAddress ?? getString(getResourceObject(resource.subscriber).email_address),
      currentPeriodStart: authoritative?.startTime ?? getString(resource.start_time),
      currentPeriodEnd: billingInfo?.nextBillingTime ??
        getString(getResourceObject(resource.billing_info).next_billing_time),
      userId,
      email,
      tier,
      planId,
    });

    console.info("PayPal webhook processed", { eventId, eventType, status, result });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process PayPal webhook", error);
    return NextResponse.json({ error: t("webhookProcessingFailed") }, { status: 502 });
  }
}
