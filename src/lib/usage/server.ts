import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { findEntitledBillingSubscription, type BillingSubscription } from "@/lib/billing/server";
import { getDatabase } from "@/lib/db/server";
import type { ConversionMethod } from "@/lib/conversion-types";

import { usageQuotaConfig, type UsagePeriod } from "./config";

const MAX_QUOTA_ATTEMPTS = 5;

export type UsageActorType = "anonymous" | "user";

export type UsageActor = { type: UsageActorType; key: string; email: string | null };

export type UsageWindow = { period: UsagePeriod; start: Date; end: Date };

export type QuotaContext = UsageActor & { subscriptionId: string | null; limitPages: number; aiLimitPages: number; window: UsageWindow };

export type UsageRecord = {
  actor_type: UsageActorType;
  actor_key: string;
  email: string | null;
  period: UsagePeriod;
  period_start: string;
  period_end: string;
  used_pages: number;
  used_ai_pages: number;
  updated_at: string;
};

export type QuotaResult = {
  status: "consumed" | "exceeded" | "stale";
  allowed: boolean;
  period: UsagePeriod;
  usedPages: number;
  remainingPages: number;
  limitPages: number;
  usedAiPages: number;
  remainingAiPages: number;
  aiLimitPages: number;
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

function createUtcDayWindow(now: Date): UsageWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { period: "day", start, end };
}

function isValidPeriod(startValue: string | null, endValue: string | null, now: Date): boolean {
  if (!startValue || !endValue) {
    return false;
  }

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

export function getQuotaContext(actor: UsageActor, subscription: BillingSubscription | null, now = new Date()): QuotaContext {
  if (subscription) {
    const config = usageQuotaConfig.subscriptions[subscription.tier];
    const window = getSubscriptionWindow(subscription, now);
    if (window) {
      return { ...actor, subscriptionId: subscription.id, limitPages: config.pages, aiLimitPages: config.aiPages, window };
    }
    throw new SubscriptionPeriodUnavailableError();
  }

  const config = actor.type === "anonymous" ? usageQuotaConfig.anonymous : usageQuotaConfig.authenticated;
  return { ...actor, subscriptionId: null, limitPages: config.pages, aiLimitPages: 0, window: createUtcDayWindow(now) };
}

export async function getEntitledSubscription(userId: string): Promise<BillingSubscription | null> {
  requireUsageDatabase();
  return findEntitledBillingSubscription(userId);
}

function requireUsageDatabase() {
  try {
    return getDatabase();
  } catch {
    throw new UsageUnavailableError();
  }
}

export function getUsageRecord(actor: UsageActor): Promise<UsageRecord | null> {
  return requireUsageDatabase()
    .prepare("SELECT * FROM conversion_usage WHERE actor_type = ? AND actor_key = ?")
    .bind(actor.type, actor.key)
    .first<UsageRecord>();
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
  if (!Number.isSafeInteger(pageCount) || pageCount <= 0 || !Number.isSafeInteger(context.limitPages) || context.limitPages <= 0) {
    throw new Error("Usage page values are invalid");
  }
  if (!Number.isSafeInteger(context.aiLimitPages) || context.aiLimitPages < 0 || context.aiLimitPages > context.limitPages) {
    throw new Error("AI page limit is invalid");
  }
}

export async function consumeConversionQuota(context: QuotaContext, pageCount: number, method: ConversionMethod = "code"): Promise<QuotaResult> {
  validateQuotaInput(context, pageCount);
  const db = requireUsageDatabase();
  const periodStart = context.window.start.toISOString();
  const periodEnd = context.window.end.toISOString();

  for (let attempt = 0; attempt < MAX_QUOTA_ATTEMPTS; attempt += 1) {
    // 先读用量版本，再确认有效权益；并发任务已写入新窗口时，CAS 失败后必须重新确认。
    const record = await getUsageRecord(context);
    const subscription = context.type === "user" ? await getEntitledSubscription(context.key) : null;
    const currentContext = getQuotaContext(context, subscription);
    const stale =
      context.subscriptionId !== currentContext.subscriptionId ||
      context.window.period !== currentContext.window.period ||
      context.window.start.valueOf() !== currentContext.window.start.valueOf() ||
      context.window.end.valueOf() !== currentContext.window.end.valueOf();
    const currentRecord = stale ? await getUsageRecord(context) : record;
    const currentUsedPages = currentRecord && isUsageRecordCurrent(currentRecord, currentContext) ? currentRecord.used_pages : 0;
    const currentUsedAiPages = currentRecord && isUsageRecordCurrent(currentRecord, currentContext) ? currentRecord.used_ai_pages : 0;
    const currentQuota = {
      period: currentContext.window.period,
      usedPages: currentUsedPages,
      remainingPages: Math.max(currentContext.limitPages - currentUsedPages, 0),
      limitPages: currentContext.limitPages,
      usedAiPages: currentUsedAiPages,
      remainingAiPages: Math.max(currentContext.aiLimitPages - currentUsedAiPages, 0),
      aiLimitPages: currentContext.aiLimitPages,
    };
    if (stale) {
      // 失效窗口不再结算，也不占用新权益的额度；已交付结果不受影响。
      return { ...currentQuota, status: "stale", allowed: false };
    }

    const nextUsedPages = currentUsedPages + pageCount;
    const nextUsedAiPages = currentUsedAiPages + (method === "llm" ? pageCount : 0);
    const allowed = nextUsedPages <= currentContext.limitPages && (method !== "llm" || nextUsedAiPages <= currentContext.aiLimitPages);
    const usedPages = allowed ? nextUsedPages : currentUsedPages;
    const usedAiPages = allowed ? nextUsedAiPages : currentUsedAiPages;
    const quota: QuotaResult = {
      ...currentQuota,
      status: allowed ? "consumed" : "exceeded",
      allowed,
      usedPages,
      remainingPages: Math.max(currentContext.limitPages - usedPages, 0),
      usedAiPages,
      remainingAiPages: Math.max(currentContext.aiLimitPages - usedAiPages, 0),
    };
    if (!allowed) {
      return quota;
    }

    const updatedAt = new Date().toISOString();
    if (!record) {
      const { meta } = await db
        .prepare(`INSERT INTO conversion_usage (
          actor_type, actor_key, email, period, period_start, period_end, used_pages, used_ai_pages, updated_at
        )
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
        WHERE ?1 = 'anonymous' OR NOT EXISTS (SELECT 1 FROM deleted_accounts WHERE user_id = ?2)
        ON CONFLICT (actor_type, actor_key) DO NOTHING`)
        .bind(context.type, context.key, context.email, context.window.period, periodStart, periodEnd, nextUsedPages, nextUsedAiPages, updatedAt)
        .run();
      if (!meta.changes) {
        continue;
      }
    } else {
      // Match the read version so a concurrent write forces a fresh entitlement and quota check.
      const changed = await updateUsageRecord(db, record, {
        email: context.email, period: context.window.period, period_start: periodStart, period_end: periodEnd,
        used_pages: nextUsedPages, used_ai_pages: nextUsedAiPages, updated_at: updatedAt,
      });
      if (!changed) {
        continue;
      }
    }

    return quota;
  }

  throw new UsageUnavailableError();
}

export async function releaseAiQuota(context: QuotaContext, pageCount: number): Promise<void> {
  validateQuotaInput(context, pageCount);
  const db = requireUsageDatabase();
  for (let attempt = 0; attempt < MAX_QUOTA_ATTEMPTS; attempt += 1) {
    const record = await getUsageRecord(context);
    if (!record || !isUsageRecordCurrent(record, context)) {
      return;
    }
    const changed = await updateUsageRecord(db, record, {
      ...record,
      used_pages: Math.max(0, record.used_pages - pageCount),
      used_ai_pages: Math.max(0, record.used_ai_pages - pageCount),
      updated_at: new Date().toISOString(),
    });
    if (changed) {
      return;
    }
  }
  throw new UsageUnavailableError();
}

async function updateUsageRecord(
  db: D1Database,
  previous: UsageRecord,
  next: Omit<UsageRecord, "actor_type" | "actor_key">,
): Promise<boolean> {
  const { meta } = await db
    .prepare(`UPDATE conversion_usage
      SET email = ?, period = ?, period_start = ?, period_end = ?, used_pages = ?, used_ai_pages = ?, updated_at = ?
      WHERE actor_type = ? AND actor_key = ? AND period = ? AND period_start = ? AND period_end = ?
        AND used_pages = ? AND used_ai_pages = ? AND updated_at = ?`)
    .bind(next.email, next.period, next.period_start, next.period_end, next.used_pages, next.used_ai_pages, next.updated_at,
      previous.actor_type, previous.actor_key, previous.period, previous.period_start, previous.period_end,
      previous.used_pages, previous.used_ai_pages, previous.updated_at)
    .run();
  return meta.changes > 0;
}

export function isUsageRecordCurrent(record: UsageRecord, context: QuotaContext): boolean {
  return (
    record.period === context.window.period &&
    sameInstant(record.period_start, context.window.start) &&
    sameInstant(record.period_end, context.window.end)
  );
}
