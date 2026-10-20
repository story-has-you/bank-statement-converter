import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentProviderId } from "./provider";
import type { MembershipTier } from "./types";

export type CheckoutIntent = {
  user_id: string;
  provider: PaymentProviderId;
  tier: MembershipTier;
  provider_plan_id: string;
  attempt_id: string;
  status: "CREATING" | "READY" | "UNKNOWN" | "COMPLETED" | "CLOSED";
  checkout_id: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type IntentSelection = Pick<CheckoutIntent, "user_id" | "provider" | "tier" | "provider_plan_id">;
type IntentChanges = Partial<Pick<CheckoutIntent, "status" | "checkout_id" | "checkout_url" | "expires_at">>;

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Supabase admin configuration is incomplete");
  }
  return admin;
}

function newAttempt(selection: IntentSelection): CheckoutIntent {
  const now = new Date().toISOString();
  return {
    ...selection,
    attempt_id: randomUUID(),
    status: "CREATING",
    checkout_id: null,
    checkout_url: null,
    expires_at: null,
    created_at: now,
    updated_at: now,
  };
}

export async function findCheckoutIntent(userId: string): Promise<CheckoutIntent | null> {
  const { data, error } = await requireAdminClient().from("billing_subscription_intents").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data as CheckoutIntent | null;
}

/** user_id 主键竞争决定唯一创建者，冲突不能覆盖已有渠道或创建引用。 */
export async function reserveCheckoutIntent(selection: IntentSelection): Promise<{ intent: CheckoutIntent; owned: boolean }> {
  const intent = newAttempt(selection);
  const { error } = await requireAdminClient().from("billing_subscription_intents").insert(intent);
  if (!error) {
    return { intent, owned: true };
  }
  if (error.code !== "23505") {
    throw error;
  }
  const existing = await findCheckoutIntent(selection.user_id);
  if (!existing) {
    throw new Error("Checkout intent disappeared while reserving");
  }
  return { intent: existing, owned: false };
}

/** 只有已确认完成或关闭的占位可以轮换，旧请求不能获得新尝试的所有权。 */
export async function replaceCheckoutIntent(intent: CheckoutIntent, selection: IntentSelection): Promise<CheckoutIntent | null> {
  const { data, error } = await requireAdminClient()
    .from("billing_subscription_intents")
    .update(newAttempt(selection))
    .eq("user_id", intent.user_id)
    .eq("attempt_id", intent.attempt_id)
    .eq("status", intent.status)
    .in("status", ["COMPLETED", "CLOSED"])
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as CheckoutIntent | null;
}

export async function updateCheckoutIntent(intent: CheckoutIntent, changes: IntentChanges): Promise<CheckoutIntent | null> {
  const { data, error } = await requireAdminClient()
    .from("billing_subscription_intents")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("user_id", intent.user_id)
    .eq("attempt_id", intent.attempt_id)
    .eq("status", intent.status)
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as CheckoutIntent | null;
}
