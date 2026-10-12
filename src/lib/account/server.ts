import "server-only";

import { listBillingSubscriptions, selectEntitledSubscription } from "@/lib/billing/server";
import { getQuotaContext, getUsageRecord, isUsageRecordCurrent } from "@/lib/usage/server";
import type { AccountSnapshot } from "@/lib/account/types";

export async function getAccountSnapshot(user: { id: string; email?: string }): Promise<AccountSnapshot> {
  let records;
  try {
    records = await listBillingSubscriptions(user.id);
  } catch {
    console.error("Failed to load account subscriptions");
    return { subscriptions: null, quota: null, currentTier: null };
  }

  const now = new Date();
  const subscription = selectEntitledSubscription(records, now);
  const snapshot: AccountSnapshot = {
    subscriptions: records.map((record) => ({
      provider: record.provider,
      subscriptionId: record.provider_subscription_id,
      tier: record.tier,
      status: record.status,
      amount: record.amount,
      currencyCode: record.currency_code,
      createdAt: record.created_at ?? null,
      periodStart: record.current_period_start,
      periodEnd: record.current_period_end,
      entitlementActive: subscription?.id === record.id,
    })),
    currentTier: subscription?.tier ?? null,
    quota: null,
  };

  try {
    const actor = { type: "user" as const, key: user.id, email: user.email ?? null };
    const context = getQuotaContext(actor, subscription, now);
    const record = await getUsageRecord(actor);
    const usedPages = record && isUsageRecordCurrent(record, context) ? Math.max(record.used_pages, 0) : 0;
    const remainingPages = Math.max(context.limitPages - usedPages, 0);
    snapshot.quota = {
      period: context.window.period,
      usedPages,
      remainingPages,
      limitPages: context.limitPages,
      remainingPercent: Math.min(100, Math.max(0, remainingPages / context.limitPages * 100)),
      periodEnd: context.window.end.toISOString(),
    };
  } catch {
    console.error("Failed to load account quota");
  }
  return snapshot;
}
