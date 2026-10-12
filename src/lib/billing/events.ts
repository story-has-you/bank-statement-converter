import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingNotification } from "./provider";
import { insertActivatedBillingSubscription, findBillingSubscriptionByProviderId, updateBillingSubscriptionFromWebhook } from "./server";
import { checkSubscriptionIdentity } from "./subscriptions";

function requireTime(value: string | null): number {
  const result = Date.parse(value ?? "");
  if (!Number.isFinite(result)) throw new Error("Billing period evidence is incomplete");
  return result;
}

/** 仅接受渠道验签和远端核实后的标准化事件，统一控制持久化及账期演进。 */
export async function applyBillingEvent(notification: BillingNotification): Promise<"applied" | "ignored"> {
  const existing = notification.type === "subscription-activated" ? null
    : await findBillingSubscriptionByProviderId(notification.provider, notification.subscriptionId);
  if (notification.type !== "subscription-activated") {
    if (!existing) throw new Error("Subscription activation is not stored yet; retry required");
    if (existing.last_webhook_event_id === notification.id) return "ignored";
  }
  const event = await notification.resolve();
  const remote = event.subscription;
  if (event.type === "subscription-activated") {
    const start = requireTime(remote.periodStart);
    const end = requireTime(remote.periodEnd);
    if (remote.status !== "ACTIVE" || start >= end || end <= Date.now()) throw new Error("Subscription activation period is invalid");
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase admin configuration is incomplete");
    const { data, error } = await admin.auth.admin.getUserById(remote.userId);
    if (error) throw error;
    if (!data.user?.email) throw new Error("Subscription user has no account email");
    return insertActivatedBillingSubscription({
      provider: event.provider, eventId: event.id, eventAt: event.at,
      subscriptionId: remote.subscriptionId, planId: remote.planId, userId: remote.userId,
      email: data.user.email, tier: remote.tier, amount: event.amount, currencyCode: event.currencyCode,
      payerId: remote.payerId, subscriberEmail: remote.subscriberEmail,
      currentPeriodStart: remote.periodStart!, currentPeriodEnd: remote.periodEnd!,
    });
  }
  if (!existing) throw new Error("Subscription activation is not stored yet; retry required");
  checkSubscriptionIdentity(existing, remote);
  if (event.type === "subscription-cancelled") {
    if (remote.status !== "CANCELLED") throw new Error("Subscription cancellation is not confirmed");
    return updateBillingSubscriptionFromWebhook(existing, event, { status: "CANCELLED" });
  }
  if (existing.status !== "ACTIVE" || remote.status !== "ACTIVE") return "ignored";
  if (existing.last_event_at && Date.parse(event.at) < Date.parse(existing.last_event_at)) return "ignored";
  const previousEnd = requireTime(existing.current_period_end);
  const saleAt = requireTime(event.saleAt);
  const paidAt = requireTime(event.paidAt);
  const end = requireTime(remote.periodEnd);
  if (end <= previousEnd) {
    if (saleAt >= previousEnd) throw new Error("Renewed billing period is not ready; retry required");
    return "ignored";
  }
  const start = Math.max(previousEnd, paidAt);
  if (end <= Date.now() || start >= end || start > Date.now()) throw new Error("Renewed billing period is invalid");
  return updateBillingSubscriptionFromWebhook(existing, event, {
    current_period_start: new Date(start).toISOString(), current_period_end: new Date(end).toISOString(),
  });
}
