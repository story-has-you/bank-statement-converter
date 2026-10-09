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

export async function reserveBillingSubscriptionIntent(
  userId: string,
  tier: MembershipTier,
  planId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");
  const { data, error } = await admin.rpc("reserve_billing_subscription_intent", {
    p_user_id: userId,
    p_tier: tier,
    p_plan_id: planId,
  });
  if (error) throw error;
  return data === true;
}

export async function releaseBillingSubscriptionIntent(userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");
  const { error } = await admin.rpc("release_billing_subscription_intent", { p_user_id: userId });
  if (error) throw error;
}

export async function bindBillingSubscriptionIntent(userId: string, subscriptionId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");
  const { data, error } = await admin.rpc("bind_billing_subscription_intent", {
    p_user_id: userId,
    p_subscription_id: subscriptionId,
  });
  if (error) throw error;
  return data === true;
}

export async function releaseBillingSubscriptionIntentForSubscription(
  userId: string,
  subscriptionId: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");
  const { error } = await admin.rpc("release_billing_subscription_intent_for_subscription", {
    p_user_id: userId,
    p_subscription_id: subscriptionId,
  });
  if (error) throw error;
}

export type BillingWebhookUpdate = {
  eventId: string;
  eventAt: string;
  eventType: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  payerId: string | null;
  subscriberEmail: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  userId: string | null;
  email: string | null;
  tier: MembershipTier | null;
  planId: string | null;
};

export async function applyBillingWebhook(update: BillingWebhookUpdate): Promise<"applied" | "ignored"> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");

  const { data, error } = await admin.rpc("apply_billing_webhook_event", {
    p_event_id: update.eventId,
    p_event_at: update.eventAt,
    p_event_type: update.eventType,
    p_subscription_id: update.subscriptionId,
    p_status: update.status,
    p_payer_id: update.payerId,
    p_subscriber_email: update.subscriberEmail,
    p_current_period_start: update.currentPeriodStart,
    p_current_period_end: update.currentPeriodEnd,
    p_user_id: update.userId,
    p_email: update.email,
    p_tier: update.tier,
    p_plan_id: update.planId,
  });
  if (error) throw error;
  if (data === "applied" || data === "ignored") return data;
  throw new Error("Billing webhook returned an invalid result");
}
