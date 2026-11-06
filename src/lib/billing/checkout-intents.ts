import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingProviderId } from "./provider";
import type { MembershipTier } from "./types";

export type CheckoutIntent = {
  user_id: string;
  provider: BillingProviderId;
  tier: MembershipTier;
  provider_plan_id: string;
  quoted_amount_usd: number | null;
  attempt_id: string;
  status: "CREATING" | "READY" | "UNKNOWN" | "COMPLETED" | "CLOSED";
  checkout_id: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }
  return admin;
}

export async function findCheckoutIntent(userId: string, attemptId: string): Promise<CheckoutIntent | null> {
  const { data, error } = await requireAdminClient().from("billing_subscription_intents").select("*").eq("user_id", userId).eq("attempt_id", attemptId).maybeSingle();
  if (error) {
    throw error;
  }
  return data as CheckoutIntent | null;
}
