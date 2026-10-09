import { createAdminClient } from "@/lib/supabase/admin";

import type { MembershipTier, SubscriptionStatus } from "./types";

export type BillingSubscription = {
  id: string;
  user_id: string;
  email: string;
  tier: MembershipTier;
  paypal_subscription_id: string;
  paypal_plan_id: string;
  status: SubscriptionStatus;
  amount: number | null;
  currency_code: string | null;
  payer_id: string | null;
  subscriber_email: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_webhook_event_id: string | null;
  last_event_at: string | null;
};

export async function findBillingSubscriptionByPayPalId(
  paypalSubscriptionId: string,
): Promise<BillingSubscription | null> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("paypal_subscription_id", paypalSubscriptionId)
    .maybeSingle();

  if (error) throw error;
  return data as BillingSubscription | null;
}

export async function findActiveBillingSubscription(userId: string): Promise<BillingSubscription | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BillingSubscription | null;
}

export async function findOpenBillingSubscription(userId: string): Promise<BillingSubscription | null> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");

  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["APPROVAL_PENDING", "APPROVED", "ACTIVE", "SUSPENDED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BillingSubscription | null;
}

export type BillingWebhookUpdate = {
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
  currencyCode: string;
};

export async function applyBillingWebhook(update: BillingWebhookUpdate): Promise<"applied" | "ignored"> {
  if (await findBillingSubscriptionByPayPalId(update.subscriptionId)) return "ignored";

  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");

  const { error } = await admin.from("billing_subscriptions").insert({
    user_id: update.userId,
    email: update.email,
    tier: update.tier,
    paypal_subscription_id: update.subscriptionId,
    paypal_plan_id: update.planId,
    status: "ACTIVE",
    amount: update.amount,
    currency_code: update.currencyCode,
    payer_id: update.payerId,
    subscriber_email: update.subscriberEmail,
    current_period_start: update.currentPeriodStart,
    current_period_end: update.currentPeriodEnd,
    last_webhook_event_id: update.eventId,
    last_event_at: update.eventAt,
  });
  if (!error) return "applied";
  if (error.code !== "23505") throw error;

  if (await findBillingSubscriptionByPayPalId(update.subscriptionId)) return "ignored";

  throw error;
}
