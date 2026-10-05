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
    .in("status", ["APPROVED", "ACTIVE"])
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
