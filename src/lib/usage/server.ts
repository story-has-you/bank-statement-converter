import { createHash, randomUUID } from "node:crypto";

import { findEntitledBillingSubscription, type BillingSubscription } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { usageQuotaConfig, type UsagePeriod } from "./config";

const MAX_QUOTA_ATTEMPTS = 5;

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

export class SubscriptionPeriodUnavailableError extends Error {
  constructor() {
    super("Active subscription period is unavailable");
    this.name = "SubscriptionPeriodUnavailableError";
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

function sameInstant(left: string, right: Date): boolean {
  const parsed = new Date(left);
  return !Number.isNaN(parsed.valueOf()) && parsed.valueOf() === right.valueOf();
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
    throw new SubscriptionPeriodUnavailableError();
  }

  const config = actor.type === "anonymous" ? usageQuotaConfig.anonymous : usageQuotaConfig.authenticated;
  return { ...actor, limitPages: config.pages, window: createUtcWindow(config.period, now) };
}

export async function getEntitledSubscription(userId: string): Promise<BillingSubscription | null> {
  if (!createAdminClient()) throw new UsageUnavailableError();
  return findEntitledBillingSubscription(userId);
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

function validateQuotaInput(context: QuotaContext, pageCount: number): void {
  if (context.type !== "anonymous" && context.type !== "user") {
    throw new Error("Invalid usage actor type");
  }
  if (context.window.period !== "day" && context.window.period !== "month") {
    throw new Error("Invalid usage period");
  }
  if (typeof context.key !== "string" || !context.key.trim()) {
    throw new Error("Usage actor key is required");
  }

  const start = context.window.start.valueOf();
  const end = context.window.end.valueOf();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("Usage period is invalid");
  }
  if (
    !Number.isSafeInteger(pageCount) || pageCount <= 0 ||
    !Number.isSafeInteger(context.limitPages) || context.limitPages <= 0
  ) {
    throw new Error("Usage page values are invalid");
  }
}

export async function consumeConversionQuota(
  context: QuotaContext,
  pageCount: number,
): Promise<QuotaResult> {
  validateQuotaInput(context, pageCount);
  const admin = requireAdminClient();
  const periodStart = context.window.start.toISOString();
  const periodEnd = context.window.end.toISOString();

  for (let attempt = 0; attempt < MAX_QUOTA_ATTEMPTS; attempt += 1) {
    const record = await getUsageRecord(context);
    const currentUsedPages = record && isUsageRecordCurrent(record, context) ? record.used_pages : 0;
    const nextUsedPages = currentUsedPages + pageCount;
    const allowed = nextUsedPages <= context.limitPages;
    const usedPages = allowed ? nextUsedPages : currentUsedPages;
    const quota: QuotaResult = {
      allowed,
      period: context.window.period,
      usedPages,
      remainingPages: Math.max(context.limitPages - usedPages, 0),
      limitPages: context.limitPages,
    };
    if (!allowed) return quota;

    const changes = {
      email: context.email,
      period: context.window.period,
      period_start: periodStart,
      period_end: periodEnd,
      used_pages: nextUsedPages,
      updated_at: new Date().toISOString(),
    };
    if (!record) {
      const { error } = await admin.from("conversion_usage").insert({
        actor_type: context.type,
        actor_key: context.key,
        ...changes,
      });
      if (error?.code === "23505") continue;
      if (error) throw error;
    } else {
      // 仅更新读取时的版本；其他请求已扣减或切换周期时，重读后重新计算。
      const { data, error } = await admin
        .from("conversion_usage")
        .update(changes)
        .eq("actor_type", context.type)
        .eq("actor_key", context.key)
        .eq("period", record.period)
        .eq("period_start", record.period_start)
        .eq("period_end", record.period_end)
        .eq("used_pages", record.used_pages)
        .eq("updated_at", record.updated_at)
        .select("actor_key");
      if (error) throw error;
      if (!data.length) continue;
    }

    return quota;
  }

  throw new UsageUnavailableError();
}

export function isUsageRecordCurrent(record: UsageRecord, context: QuotaContext): boolean {
  return (
    record.period === context.window.period &&
    sameInstant(record.period_start, context.window.start) &&
    sameInstant(record.period_end, context.window.end)
  );
}
