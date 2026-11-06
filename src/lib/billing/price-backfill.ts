import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutIntent } from "./checkout-intents";
import type { BillingSubscription } from "./server";
import { requireRecurringAmount } from "./usd";
import { checkSubscriptionIdentity } from "./subscriptions";
import { getWaffoCheckoutOrders, getWaffoSubscription } from "./providers/waffo/server";
import { getWaffoAgreedAmount, normalizeWaffoSubscription } from "./providers/waffo/subscription";

/** Reads every page: a default Data API row limit must never hide a release blocker. */
async function readRows<T>(admin: SupabaseClient, table: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    const { data, error } = await admin.from(table).select("*").order(order).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length === 0) return rows;
    offset += data.length;
  }
}

export async function backfillBillingPrices(admin: SupabaseClient, apply = false) {
  const subscriptions = await readRows<BillingSubscription>(admin, "billing_subscriptions", "id");
  const intents = await readRows<CheckoutIntent>(admin, "billing_subscription_intents", "attempt_id");
  const blockers: { table: string; id: string; reason: string }[] = [];
  const updates: { table: string; id: string; column: string; amount: string; row: BillingSubscription | CheckoutIntent }[] = [];

  for (const row of subscriptions) {
    if (row.status === "EXPIRED" || (row.status === "CANCELLED" && Date.parse(row.current_period_end ?? "") <= Date.now())) continue;
    try {
      if (row.provider !== "waffo") throw new Error("Retired payment provider requires platform-side closeout");
      if (row.recurring_amount_usd != null) { requireRecurringAmount(row.recurring_amount_usd); continue; }
      const remote = await getWaffoSubscription(row.provider_subscription_id);
      checkSubscriptionIdentity(row, normalizeWaffoSubscription(remote));
      const amount = getWaffoAgreedAmount(remote);
      updates.push({ table: "billing_subscriptions", id: row.id, column: "recurring_amount_usd", amount, row });
    } catch {
      blockers.push({ table: "billing_subscriptions", id: row.id, reason: row.provider !== "waffo" ? "Retired payment provider closeout required" : "Missing or inconsistent subscription-level price evidence" });
    }
  }

  for (const row of intents) {
    if (row.status === "COMPLETED" || row.status === "CLOSED") continue;
    try {
      if (row.provider !== "waffo" || row.status === "CREATING" || !row.checkout_id) throw new Error("Unresolved checkout");
      if (row.quoted_amount_usd != null) { requireRecurringAmount(row.quoted_amount_usd); continue; }
      const orders = await getWaffoCheckoutOrders(row.checkout_id);
      if (orders.length !== 1 || row.checkout_id !== `wco_${row.attempt_id}`) throw new Error("Checkout evidence missing");
      const normalized = normalizeWaffoSubscription(orders[0]);
      if (normalized.userId !== row.user_id || normalized.tier !== row.tier || normalized.planId !== row.provider_plan_id ||
        orders[0].orderMerchantExternalId !== row.checkout_id) throw new Error("Checkout mismatch");
      const amount = getWaffoAgreedAmount(orders[0]);
      updates.push({ table: "billing_subscription_intents", id: row.attempt_id, column: "quoted_amount_usd", amount, row });
    } catch {
      blockers.push({ table: "billing_subscription_intents", id: row.attempt_id, reason: "Checkout must be reconciled; no price is inferred or reservation released" });
    }
  }

  let applied = 0;
  if (apply && blockers.length === 0) {
    for (const update of updates) {
      const { row } = update;
      let query = admin.from(update.table).update({ [update.column]: update.amount })
        .eq(update.table === "billing_subscriptions" ? "id" : "attempt_id", update.id)
        .eq("provider", row.provider).eq("provider_plan_id", row.provider_plan_id)
        .eq("user_id", row.user_id).eq("tier", row.tier).eq("status", row.status).is(update.column, null);
      if ("attempt_id" in row) {
        query = query.eq("attempt_id", row.attempt_id).eq("checkout_id", row.checkout_id!);
      } else {
        query = query.eq("provider_subscription_id", row.provider_subscription_id);
        query = row.last_event_at === null ? query.is("last_event_at", null) : query.eq("last_event_at", row.last_event_at);
        query = row.last_webhook_event_id === null
          ? query.is("last_webhook_event_id", null)
          : query.eq("last_webhook_event_id", row.last_webhook_event_id);
      }
      const { data, error } = await query.select(update.column);
      if (error || data?.length !== 1) throw new Error("Price backfill changed concurrently; keep purchasing paused and rerun audit");
      applied++;
    }
  }
  return {
    mode: apply ? "apply" : "dry-run", applied,
    updates: updates.map(({ table, id, column, amount }) => ({ table, id, column, amount })), blockers,
    releaseReady: false,
    requiredManualChecks: ["Retired payment platforms: no renewable subscriptions, payable checkouts, or unprocessed payments", "Waffo sandbox checkout and signed callback acceptance"],
  };
}
