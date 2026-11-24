import "server-only";

import type { BillingProviderId, PaymentProviderId } from "./provider";
import { getDatabase } from "@/lib/db/server";
import { requireRecurringAmount, usdFromDecimal } from "./usd";

import type { MembershipTier, SubscriptionStatus } from "./types";

export type BillingSubscription = {
  id: string;
  user_id: string;
  email: string;
  tier: MembershipTier;
  provider: BillingProviderId;
  provider_subscription_id: string;
  provider_plan_id: string;
  status: SubscriptionStatus;
  amount: number | null;
  recurring_amount_usd: number | null;
  original_amount: number | null;
  discount_amount: number | null;
  provider_discount_id: string | null;
  currency_code: string | null;
  payer_id: string | null;
  subscriber_email: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_webhook_event_id: string | null;
  last_event_at: string | null;
  created_at: string;
};

const subscriptionColumns = `
  id, user_id, email, tier, provider, provider_subscription_id, provider_plan_id, status,
  amount_cents / 100.0 AS amount, recurring_amount_cents / 100.0 AS recurring_amount_usd,
  original_amount_cents / 100.0 AS original_amount, discount_amount_cents / 100.0 AS discount_amount,
  provider_discount_id, currency_code, payer_id, subscriber_email, current_period_start,
  current_period_end, last_webhook_event_id, last_event_at, created_at
`;
const openStatuses = "('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED')";

export function findBillingSubscriptionByProviderId(
  provider: BillingProviderId,
  subscriptionId: string,
): Promise<BillingSubscription | null> {
  return getDatabase()
    .prepare(`SELECT ${subscriptionColumns} FROM billing_subscriptions WHERE provider = ? AND provider_subscription_id = ?`)
    .bind(provider, subscriptionId)
    .first<BillingSubscription>();
}

export async function listBillingSubscriptions(userId: string): Promise<BillingSubscription[]> {
  const { results } = await getDatabase()
    .prepare(`SELECT ${subscriptionColumns} FROM billing_subscriptions WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(userId)
    .all<BillingSubscription>();
  return results;
}

function isPaidPeriodCurrent(subscription: BillingSubscription, now: Date): boolean {
  const start = Date.parse(subscription.current_period_start ?? "");
  const end = Date.parse(subscription.current_period_end ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && start < end && start <= now.valueOf() && now.valueOf() < end;
}

export function selectEntitledSubscription(subscriptions: BillingSubscription[], now = new Date()): BillingSubscription | null {
  const active = subscriptions.find((subscription) => subscription.status === "ACTIVE" && isPaidPeriodCurrent(subscription, now));
  if (active) {
    return active;
  }

  return (
    subscriptions.find((subscription) => {
      const paidStatus = subscription.status === "CANCELLED" || subscription.status === "PAYMENT_FAILED";
      return paidStatus && isPaidPeriodCurrent(subscription, now);
    }) ?? null
  );
}

export async function findEntitledBillingSubscription(userId: string): Promise<BillingSubscription | null> {
  return selectEntitledSubscription(await listBillingSubscriptions(userId));
}

export async function updateBillingSubscriptionFromWebhook(
  subscription: BillingSubscription,
  event: { id: string; at: string; type?: string },
  changes: { status: SubscriptionStatus } | { status?: "ACTIVE" | "CANCELLED"; current_period_start: string; current_period_end: string },
): Promise<"applied" | "ignored"> {
  if (subscription.last_webhook_event_id === event.id) {
    return "ignored";
  }
  const olderEvent = subscription.last_event_at !== null && Date.parse(event.at) < Date.parse(subscription.last_event_at);
  // 已向支付渠道确认的取消是终态；付款事件即使晚生成也不能阻止取消落库。
  if (olderEvent && changes.status !== "CANCELLED") {
    return "ignored";
  }
  const resumingCancellation = event.type === "subscription-resumed" && changes.status === "ACTIVE";
  // 已取消续费不妨碍补齐已核实的新账期，但付款不能撤销取消。
  const advancingCancelledPeriod =
    event.type === "subscription-paid" &&
    changes.status === "CANCELLED" &&
    "current_period_end" in changes &&
    Date.parse(changes.current_period_end) > Date.parse(subscription.current_period_end ?? "");
  if (subscription.status === "EXPIRED" || (subscription.status === "CANCELLED" && !resumingCancellation && !advancingCancelledPeriod)) {
    return "ignored";
  }

  const { meta } = await getDatabase()
    .prepare(`UPDATE billing_subscriptions
      SET status = COALESCE(?1, status),
          current_period_start = COALESCE(?2, current_period_start),
          current_period_end = COALESCE(?3, current_period_end),
          last_webhook_event_id = ?4, last_event_at = ?5, updated_at = ?6
      WHERE id = ?7 AND status = ?8 AND last_event_at IS ?9 AND last_webhook_event_id IS ?10`)
    .bind(
      changes.status ?? null,
      "current_period_start" in changes ? new Date(changes.current_period_start).toISOString() : null,
      "current_period_end" in changes ? new Date(changes.current_period_end).toISOString() : null,
      event.id, olderEvent ? subscription.last_event_at : new Date(event.at).toISOString(),
      new Date().toISOString(), subscription.id, subscription.status,
      subscription.last_event_at, subscription.last_webhook_event_id,
    )
    .run();
  if (!meta.changes) {
    throw new Error("Subscription changed while processing webhook; retry required");
  }
  return "applied";
}

export function findOpenBillingSubscription(userId: string): Promise<BillingSubscription | null> {
  return getDatabase()
    .prepare(`SELECT ${subscriptionColumns} FROM billing_subscriptions
      WHERE user_id = ? AND status IN ${openStatuses} ORDER BY created_at DESC LIMIT 1`)
    .bind(userId)
    .first<BillingSubscription>();
}

export async function updateBillingSubscriptionStatus(
  subscription: BillingSubscription,
  status: "CANCELLED" | "EXPIRED",
): Promise<"applied" | "ignored"> {
  const { meta } = await getDatabase()
    .prepare(`UPDATE billing_subscriptions SET status = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND status = ? AND last_event_at IS ? AND last_webhook_event_id IS ?`)
    .bind(status, new Date().toISOString(), subscription.id, subscription.user_id,
      subscription.status, subscription.last_event_at, subscription.last_webhook_event_id)
    .run();
  return meta.changes ? "applied" : "ignored";
}

export type BillingActivation = {
  status?: "ACTIVE" | "CANCELLED";
  provider: PaymentProviderId;
  eventId: string;
  eventAt: string;
  subscriptionId: string;
  payerId: string | null;
  subscriberEmail: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  userId: string;
  email: string;
  tier: MembershipTier;
  planId: string;
  amount: string;
  recurringAmount: string;
  originalAmount: string;
  discountAmount: string;
  providerDiscountId: string | null;
  currencyCode: string;
};

export async function insertActivatedBillingSubscription(update: BillingActivation): Promise<"applied" | "ignored"> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const status = update.status ?? "ACTIVE";
  const { meta } = await db
    .prepare(`INSERT INTO billing_subscriptions (
      id, user_id, email, tier, provider, provider_subscription_id, provider_plan_id, status,
      amount_cents, recurring_amount_cents, original_amount_cents, discount_amount_cents,
      provider_discount_id, currency_code, payer_id, subscriber_email, current_period_start,
      current_period_end, last_webhook_event_id, last_event_at, created_at, updated_at
    )
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?21
    WHERE NOT EXISTS (SELECT 1 FROM deleted_accounts WHERE user_id = ?2)
      AND (?8 = 'CANCELLED' OR NOT EXISTS (
        SELECT 1 FROM billing_subscriptions WHERE user_id = ?2 AND (
          status IN ${openStatuses}
          OR (status = 'CANCELLED' AND current_period_start <= ?21 AND current_period_end > ?21)
        )
      ))
    ON CONFLICT (provider, provider_subscription_id) DO NOTHING`)
    .bind(
      crypto.randomUUID(), update.userId, update.email, update.tier, update.provider, update.subscriptionId,
      update.planId, status, usdFromDecimal(update.amount), usdFromDecimal(requireRecurringAmount(update.recurringAmount)),
      usdFromDecimal(update.originalAmount), usdFromDecimal(update.discountAmount), update.providerDiscountId,
      update.currencyCode, update.payerId, update.subscriberEmail, new Date(update.currentPeriodStart).toISOString(),
      new Date(update.currentPeriodEnd).toISOString(), update.eventId, new Date(update.eventAt).toISOString(), now,
    )
    .run();
  if (meta.changes) {
    return "applied";
  }
  if (await findBillingSubscriptionByProviderId(update.provider, update.subscriptionId)) {
    return "ignored";
  }
  if (await db.prepare("SELECT 1 FROM deleted_accounts WHERE user_id = ?").bind(update.userId).first()) {
    return "ignored";
  }
  throw new Error("Account already has an open or paid cancelled subscription");
}
