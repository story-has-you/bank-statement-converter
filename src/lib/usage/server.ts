import { createHash, randomUUID } from "node:crypto";

import { findActiveBillingSubscription, type BillingSubscription } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { usageQuotaConfig, type UsagePeriod } from "./config";

export type UsageActorType = "anonymous" | "user";

export type UsageActor = {
  type: UsageActorType;
  key: string;
  email: string | null;
};

export type UsageWindow = {
  period: UsagePeriod;
  start: Date;
  end: Date;
};

export type QuotaContext = UsageActor & {
  limitPages: number;
  window: UsageWindow;
};

export type UsageRecord = {
  actor_type: UsageActorType;
  actor_key: string;
  email: string | null;
  period: UsagePeriod;
  period_start: string;
  period_end: string;
  used_pages: number;
  updated_at: string;
};

export type QuotaResult = {
  allowed: boolean;
  period: UsagePeriod;
  usedPages: number;
  remainingPages: number;
  limitPages: number;
};

export class UsageUnavailableError extends Error {
  constructor() {
    super("Usage service is unavailable");
    this.name = "UsageUnavailableError";
  }
}

export function createAnonymousId(): string {
  return randomUUID();
}

export function hashAnonymousId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createUtcWindow(period: UsagePeriod, now: Date): UsageWindow {
  if (period === "day") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { period, start, end };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { period, start, end };
}

function isValidPeriod(startValue: string | null, endValue: string | null, now: Date): boolean {
  if (!startValue || !endValue) return false;

  const start = new Date(startValue);
  const end = new Date(endValue);
  return !Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf()) && start < end && now >= start && now < end;
}

function getSubscriptionWindow(subscription: BillingSubscription, now: Date): UsageWindow | null {
  if (!isValidPeriod(subscription.current_period_start, subscription.current_period_end, now)) {
    return null;
  }

  return {
    period: "month",
    start: new Date(subscription.current_period_start as string),
    end: new Date(subscription.current_period_end as string),
  };
}

export function getQuotaContext(
  actor: UsageActor,
  subscription: BillingSubscription | null,
  now = new Date(),
): QuotaContext {
  if (subscription) {
    const config = usageQuotaConfig.subscriptions[subscription.tier];
    const window = getSubscriptionWindow(subscription, now);
    if (window) return { ...actor, limitPages: config.pages, window };
  }

  const config = actor.type === "anonymous" ? usageQuotaConfig.anonymous : usageQuotaConfig.authenticated;
  return { ...actor, limitPages: config.pages, window: createUtcWindow(config.period, now) };
}

export async function getActiveSubscription(userId: string): Promise<BillingSubscription | null> {
  if (!createAdminClient()) throw new UsageUnavailableError();
  return findActiveBillingSubscription(userId);
}

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new UsageUnavailableError();
  return admin;
}

export async function getUsageRecord(actor: UsageActor): Promise<UsageRecord | null> {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("conversion_usage")
    .select("actor_type, actor_key, email, period, period_start, period_end, used_pages, updated_at")
    .eq("actor_type", actor.type)
    .eq("actor_key", actor.key)
    .maybeSingle();

  if (error) throw error;
  return data as UsageRecord | null;
}

function isQuotaResult(value: unknown): value is QuotaResult {
  if (typeof value !== "object" || value === null) return false;
  if (!("allowed" in value) || !("period" in value) || !("usedPages" in value)) return false;
  if (!("remainingPages" in value) || !("limitPages" in value)) return false;

  return (
    typeof value.allowed === "boolean" &&
    (value.period === "day" || value.period === "month") &&
    typeof value.usedPages === "number" &&
    typeof value.remainingPages === "number" &&
    typeof value.limitPages === "number"
  );
}

export async function consumeConversionQuota(
  context: QuotaContext,
  pageCount: number,
): Promise<QuotaResult> {
  const admin = requireAdminClient();
  const { data, error } = await admin.rpc("consume_conversion_quota", {
    p_actor_type: context.type,
    p_actor_key: context.key,
    p_email: context.email,
    p_period: context.window.period,
    p_period_start: context.window.start.toISOString(),
    p_period_end: context.window.end.toISOString(),
    p_page_count: pageCount,
    p_limit_pages: context.limitPages,
  });

  if (error) throw error;
  if (!isQuotaResult(data)) throw new Error("Usage service returned an invalid quota result");
  return data;
}

export function isUsageRecordCurrent(record: UsageRecord, context: QuotaContext): boolean {
  return (
    record.period === context.window.period &&
    record.period_start === context.window.start.toISOString() &&
    record.period_end === context.window.end.toISOString()
  );
}
