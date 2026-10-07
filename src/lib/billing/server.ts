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

export async function upsertBillingSubscription(
  subscription: BillingSubscription | Omit<BillingSubscription, "id">,
): Promise<BillingSubscription> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }

  const { data, error } = await admin
    .from("billing_subscriptions")
    .upsert(subscription, { onConflict: "paypal_subscription_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as BillingSubscription;
}

export type BillingWebhookUpdate = {
  eventId: string;
  eventAt: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  payerId: string | null;
  subscriberEmail: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export async function applyBillingWebhook(update: BillingWebhookUpdate): Promise<"applied" | "ignored" | "not_found"> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin configuration is incomplete");

  const { data, error } = await admin.rpc("apply_billing_webhook", {
    p_event_id: update.eventId,
    p_event_at: update.eventAt,
    p_subscription_id: update.subscriptionId,
    p_status: update.status,
    p_payer_id: update.payerId,
    p_subscriber_email: update.subscriberEmail,
    p_current_period_start: update.currentPeriodStart,
    p_current_period_end: update.currentPeriodEnd,
  });
  if (error) throw error;
  if (data === "applied" || data === "ignored" || data === "not_found") return data;
  throw new Error("Billing webhook returned an invalid result");
}
