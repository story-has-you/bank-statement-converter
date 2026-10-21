import "server-only";

import type { PaymentProviderId } from "./provider";
import { createAdminClient } from "@/lib/supabase/admin";

import type { MembershipTier, SubscriptionStatus } from "./types";

export type BillingSubscription = {
  id: string;
  user_id: string;
  email: string;
  tier: MembershipTier;
  provider: PaymentProviderId;
  provider_subscription_id: string;
  provider_plan_id: string;
  status: SubscriptionStatus;
  amount: number | null;
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

export async function findBillingSubscriptionByProviderId(
  provider: PaymentProviderId,
  subscriptionId: string,
): Promise<BillingSubscription | null> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("provider", provider)
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as BillingSubscription | null;
}

export async function listBillingSubscriptions(userId: string): Promise<BillingSubscription[]> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .in("provider", ["creem", "paypal", "waffo"])
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data as BillingSubscription[];
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

  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  // 比较读取时的事件版本，避免并发回调覆盖取消状态或更新后的账期。
  let query = admin
    .from("billing_subscriptions")
    .update({
      ...changes,
      last_webhook_event_id: event.id,
      last_event_at: olderEvent ? subscription.last_event_at : event.at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id)
    .eq("status", subscription.status);
  query = subscription.last_event_at === null ? query.is("last_event_at", null) : query.eq("last_event_at", subscription.last_event_at);
  query =
    subscription.last_webhook_event_id === null
      ? query.is("last_webhook_event_id", null)
      : query.eq("last_webhook_event_id", subscription.last_webhook_event_id);

  const { data, error } = await query.select("id");
  if (error) {
    throw error;
  }
  if (!data.length) {
    throw new Error("Subscription changed while processing webhook; retry required");
  }
  return "applied";
}

export async function findOpenBillingSubscription(userId: string): Promise<BillingSubscription | null> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .in("provider", ["creem", "paypal", "waffo"])
    .eq("user_id", userId)
    .in("status", ["APPROVAL_PENDING", "APPROVED", "ACTIVE", "SUSPENDED", "PAYMENT_FAILED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as BillingSubscription | null;
}

export async function updateBillingSubscriptionStatus(
  subscription: BillingSubscription,
  status: "CANCELLED" | "EXPIRED",
): Promise<"applied" | "ignored"> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  // 只更新读取时的版本；并发 Webhook 已改动状态或账期时，交由下一次同步重试。
  let query = admin
    .from("billing_subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subscription.id)
    .eq("user_id", subscription.user_id)
    .eq("status", subscription.status);
  query = subscription.last_event_at === null ? query.is("last_event_at", null) : query.eq("last_event_at", subscription.last_event_at);
  query =
    subscription.last_webhook_event_id === null
      ? query.is("last_webhook_event_id", null)
      : query.eq("last_webhook_event_id", subscription.last_webhook_event_id);

  const { data, error } = await query.select("id");
  if (error) {
    throw error;
  }
  return data.length ? "applied" : "ignored";
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
  originalAmount: string;
  discountAmount: string;
  providerDiscountId: string | null;
  currencyCode: string;
};

export async function insertActivatedBillingSubscription(update: BillingActivation): Promise<"applied" | "ignored"> {
  if (await findBillingSubscriptionByProviderId(update.provider, update.subscriptionId)) {
    return "ignored";
  }

  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  const open = await findOpenBillingSubscription(update.userId);
  if (open?.provider === update.provider && open.provider_subscription_id === update.subscriptionId) {
    return "ignored";
  }
  const entitled = await findEntitledBillingSubscription(update.userId);
  if (open || entitled?.status === "CANCELLED") {
    throw new Error("Account already has an open or paid cancelled subscription");
  }
  const { error } = await admin.from("billing_subscriptions").insert({
    provider: update.provider,
    user_id: update.userId,
    email: update.email,
    tier: update.tier,
    provider_subscription_id: update.subscriptionId,
    provider_plan_id: update.planId,
    status: update.status ?? "ACTIVE",
    amount: update.amount,
    original_amount: update.originalAmount,
    discount_amount: update.discountAmount,
    provider_discount_id: update.providerDiscountId,
    currency_code: update.currencyCode,
    payer_id: update.payerId,
    subscriber_email: update.subscriberEmail,
    current_period_start: update.currentPeriodStart,
    current_period_end: update.currentPeriodEnd,
    last_webhook_event_id: update.eventId,
    last_event_at: update.eventAt,
  });
  if (!error) {
    return "applied";
  }
  if (error.code !== "23505") {
    throw error;
  }

  if (await findBillingSubscriptionByProviderId(update.provider, update.subscriptionId)) {
    return "ignored";
  }

  throw error;
}
