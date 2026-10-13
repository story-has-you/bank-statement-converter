import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingEvent, BillingNotification } from "./provider";
import { insertActivatedBillingSubscription, findBillingSubscriptionByProviderId, updateBillingSubscriptionFromWebhook } from "./server";
import { checkSubscriptionIdentity } from "./subscriptions";

function requireTime(value: string | null): number {
  const result = Date.parse(value ?? "");
  if (!Number.isFinite(result)) throw new Error("Billing period evidence is incomplete");
  return result;
}

/** 仅接受渠道验签和远端核实后的标准化事件，统一控制持久化及账期演进。 */
export async function applyBillingEvent(notification: BillingNotification): Promise<"applied" | "ignored"> {
  if (notification.type === "subscription-paid" || notification.type === "subscription-status-changed") {
    return applyPaidSubscriptionEvent(notification);
  }
  const existing = await findBillingSubscriptionByProviderId(notification.provider, notification.subscriptionId);
  if (!existing) throw new Error("Subscription payment is not stored yet; retry required");
  if (existing.last_webhook_event_id === notification.id) return "ignored";
  const event = await notification.resolve();
  const remote = event.subscription;
  checkSubscriptionIdentity(existing, remote);
  if (event.type !== "subscription-cancelled" || remote.status !== "CANCELLED") throw new Error("Subscription cancellation is not confirmed");
  return updateBillingSubscriptionFromWebhook(existing, event, { status: "CANCELLED" });
}

/** Creem 付款先核实交易，再按已有记录区分首次付款、恢复与续费。 */
async function applyPaidSubscriptionEvent(notification: BillingNotification): Promise<"applied" | "ignored"> {
  const existing = await findBillingSubscriptionByProviderId(notification.provider, notification.subscriptionId);
  if (existing?.last_webhook_event_id === notification.id) return "ignored";
  if (existing?.last_event_at && Date.parse(notification.at) < Date.parse(existing.last_event_at)) return "ignored";
  const event = await notification.resolve();
  const remote = event.subscription;
  if (existing) checkSubscriptionIdentity(existing, remote);
  if (event.type === "subscription-status-changed") {
    if (!existing) throw new Error("Subscription payment is not stored yet; retry required");
    if (!["PAYMENT_FAILED", "SUSPENDED", "EXPIRED", "CANCELLED"].includes(remote.status)) return "ignored";
    return updateBillingSubscriptionFromWebhook(existing, event, { status: remote.status });
  }
  if (event.type !== "subscription-paid") throw new Error("Unexpected payment notification");
  if (["EXPIRED", "SUSPENDED"].includes(remote.status) || (existing && (["CANCELLED", "EXPIRED"].includes(existing.status) || remote.status === "CANCELLED"))) return "ignored";
  const start = requireTime(remote.periodStart);
  const end = requireTime(remote.periodEnd);
  if (!["ACTIVE", "CANCELLED"].includes(remote.status) || start > Date.now() || start >= end || end <= Date.now()) throw new Error("Paid subscription period is invalid");
  if (!existing) return insertConfirmedSubscription(event, remote.status === "CANCELLED" ? "CANCELLED" : "ACTIVE");
  const previousEnd = requireTime(existing.current_period_end);
  if (end < previousEnd || start < requireTime(existing.current_period_start)) return "ignored";
  if (end === previousEnd) {
    if (start !== requireTime(existing.current_period_start)) throw new Error("Paid subscription period changed unexpectedly");
    if (existing.status === "ACTIVE") return "ignored";
    return updateBillingSubscriptionFromWebhook(existing, event, { status: "ACTIVE" });
  }
  if (start < previousEnd) throw new Error("Paid subscription period overlaps the previous period");
  return updateBillingSubscriptionFromWebhook(existing, event, { status: "ACTIVE", current_period_start: remote.periodStart!, current_period_end: remote.periodEnd! });
}

async function insertConfirmedSubscription(event: Extract<BillingEvent, { type: "subscription-paid" }>, status: "ACTIVE" | "CANCELLED"): Promise<"applied" | "ignored"> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");
  const remote = event.subscription;
  const { data, error } = await admin.auth.admin.getUserById(remote.userId);
  if (error) throw error;
  if (!data.user?.email) throw new Error("Subscription user has no account email");
  return insertActivatedBillingSubscription({
    provider: event.provider,
    eventId: event.id,
    eventAt: event.at,
    status,
    subscriptionId: remote.subscriptionId,
    planId: remote.planId,
    userId: remote.userId,
    email: data.user.email,
    tier: remote.tier,
    amount: event.amount,
    currencyCode: event.currencyCode,
    payerId: remote.payerId,
    subscriberEmail: remote.subscriberEmail,
    currentPeriodStart: remote.periodStart!,
    currentPeriodEnd: remote.periodEnd!,
  });
}
