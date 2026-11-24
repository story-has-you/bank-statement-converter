import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { setupD1 } from "./helpers/d1";
import { freeQuotaConfig, subscriptionConfig } from "@/config/plans";

import type { BillingEvent, BillingNotification, ProviderSubscription } from "@/lib/billing/provider";
import type { BillingSubscription } from "@/lib/billing/server";

const fixtureModules = new Map([
  ["server-only", "export {};"],
  ["@/lib/db/server", "export const getDatabase = () => globalThis.testDatabase;"],
]);
registerHooks({
  resolve(specifier, context, next) {
    const source = fixtureModules.get(specifier);
    return source === undefined ? next(specifier, context) : {
      url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true,
    };
  },
  load(url, context, next) {
    return url.startsWith("data:text/javascript,")
      ? { format: "module", source: decodeURIComponent(url.slice(21)), shortCircuit: true }
      : next(url, context);
  },
});

const modules = Promise.all([
  import("@/lib/usage/server"),
  import("@/lib/billing/events"),
  import("@/lib/billing/usd"),
]);
const actor = { type: "user" as const, key: "user_quotaFixture", email: "fixture@example.invalid" };
const day = 86_400_000;

function subscription(changes: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    id: "fixture-subscription",
    user_id: actor.key,
    email: actor.email,
    tier: "professional",
    provider: "waffo",
    provider_subscription_id: "ORD_fixture",
    provider_plan_id: "PROD_fixture",
    status: "ACTIVE",
    amount: 24.9,
    recurring_amount_usd: 24.9,
    original_amount: 24.9,
    discount_amount: 0,
    provider_discount_id: null,
    currency_code: "USD",
    payer_id: null,
    subscriber_email: actor.email,
    current_period_start: new Date(Date.now() - day).toISOString(),
    current_period_end: new Date(Date.now() + 29 * day).toISOString(),
    last_webhook_event_id: "fixture-first",
    last_event_at: new Date(Date.now() - day).toISOString(),
    created_at: new Date(Date.now() - day).toISOString(),
    ...changes,
  };
}

function notification(
  type: BillingEvent["type"],
  id: string,
  existing: BillingSubscription,
  changes: Partial<ProviderSubscription> = {},
  at = new Date().toISOString(),
): BillingNotification {
  const provider = existing.provider;
  assert(provider === "waffo");
  const remote: ProviderSubscription = {
    subscriptionId: existing.provider_subscription_id,
    planId: existing.provider_plan_id,
    userId: existing.user_id,
    tier: existing.tier,
    status: existing.status,
    payerId: null,
    subscriberEmail: existing.email,
    periodStart: existing.current_period_start,
    periodEnd: existing.current_period_end,
    ...changes,
  };
  return {
    provider,
    id,
    at,
    type,
    subscriptionId: remote.subscriptionId,
    async resolve() {
      const base = { provider, id, at, subscription: remote };
      return type === "subscription-paid"
        ? {
            ...base,
            type,
            amount: "24.90",
            recurringAmount: "24.90",
            originalAmount: "24.90",
            discountAmount: "0.00",
            providerDiscountId: null,
            currencyCode: "USD",
            paidAt: at,
            payment: { id, periodNumber: 1, checkoutId: "wco_fixture", taxAmount: "0.00", testMode: true },
          }
        : { ...base, type };
    },
  };
}

test("real quota insert contention admits only the pages that fit", async (t) => {
  const { rows } = await setupD1(t);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const context = getQuotaContext(actor, null);
  const results = await Promise.all([consumeConversionQuota(context, 3), consumeConversionQuota(context, 3)]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["consumed", "exceeded"]);
  assert.equal((await rows("conversion_usage"))[0].used_pages, 3);
});

test("real quota CAS retries a lost update instead of losing a deduction", async (t) => {
  const { rows } = await setupD1(t);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const context = getQuotaContext(actor, null);
  await consumeConversionQuota(context, 1);
  const results = await Promise.all([consumeConversionQuota(context, 2), consumeConversionQuota(context, 2)]);
  assert(results.every((result) => result.allowed));
  assert.equal((await rows("conversion_usage"))[0].used_pages, 5);
});

test("a stale billing window cannot overwrite usage in a renewed window", async (t) => {
  const original = subscription();
  const { rows, db } = await setupD1(t, [original]);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const old = getQuotaContext(actor, original);
  await db.prepare("UPDATE billing_subscriptions SET current_period_start = ?, current_period_end = ?")
    .bind(new Date(Date.now() - 3_600_000).toISOString(), new Date(Date.now() + 30 * day).toISOString()).run();
  const current = getQuotaContext(actor, (await rows<BillingSubscription>("billing_subscriptions"))[0]);
  await consumeConversionQuota(current, 7);
  const before = structuredClone((await rows("conversion_usage")));
  assert.equal((await consumeConversionQuota(old, 2)).status, "stale");
  assert.deepEqual((await rows("conversion_usage")), before);
});

test("failed quota writes reject and invalid page counts never deduct", async (t) => {
  const { rows, db } = await setupD1(t);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const context = getQuotaContext(actor, null);
  for (const pages of [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1]) {await assert.rejects(consumeConversionQuota(context, pages));}
  await db.prepare("CREATE TRIGGER test_write_failure BEFORE INSERT ON conversion_usage BEGIN SELECT RAISE(ABORT, 'test write failure'); END").run();
  await assert.rejects(consumeConversionQuota(context, 1));
  assert.equal((await rows("conversion_usage")).length, 0);
});

test("plan A keeps prices, total pages and free quotas with AI sublimits", () => {
  assert.deepEqual(Object.values(subscriptionConfig).map(({ monthlyPrice, pages, aiPages, aiParsing }) => [monthlyPrice, pages, aiPages, aiParsing]), [
    [9.9, 500, 0, false], [24.9, 1000, 200, true], [39.9, 2000, 400, true],
  ]);
  assert.deepEqual(freeQuotaConfig, { anonymous: { period: "day", pages: 1 }, authenticated: { period: "day", pages: 5 } });
});

for (const tier of ["professional", "enterprise"] as const) {
  test(`${tier} AI sublimit counts toward total and cannot be exceeded concurrently`, async (t) => {
    const existing = subscription({ tier });
    const { rows } = await setupD1(t, [existing]);
    const [{ getQuotaContext, consumeConversionQuota }] = await modules;
    const context = getQuotaContext(actor, existing);
    const limit = subscriptionConfig[tier].aiPages;
    await consumeConversionQuota(context, limit - 1, "llm");
    const results = await Promise.all([consumeConversionQuota(context, 1, "llm"), consumeConversionQuota(context, 1, "llm")]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["consumed", "exceeded"]);
    assert.equal((await rows("conversion_usage"))[0].used_pages, limit);
    assert.equal((await rows("conversion_usage"))[0].used_ai_pages, limit);
    assert.equal((await consumeConversionQuota(context, 3)).allowed, true);
    assert.equal((await rows("conversion_usage"))[0].used_pages, limit + 3);
    assert.equal((await rows("conversion_usage"))[0].used_ai_pages, limit);
  });
}

test("AI also obeys total pages and a rejected request changes neither counter", async (t) => {
  const existing = subscription();
  const { rows } = await setupD1(t, [existing]);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const context = getQuotaContext(actor, existing);
  await consumeConversionQuota(context, context.limitPages - 1);
  const before = structuredClone((await rows("conversion_usage")));
  assert.equal((await consumeConversionQuota(context, 2, "llm")).allowed, false);
  assert.deepEqual((await rows("conversion_usage")), before);
  assert.equal((await consumeConversionQuota(context, 1, "llm")).allowed, true);
  assert.equal((await rows("conversion_usage"))[0].used_ai_pages, 1);
});

for (const tier of [null, "standard"] as const) {
  test(`${tier ?? "free"} cannot consume AI quota`, async (t) => {
    const existing = tier ? subscription({ tier }) : null;
    const { rows } = await setupD1(t, existing ? [existing] : []);
    const [{ getQuotaContext, consumeConversionQuota }] = await modules;
    assert.equal((await consumeConversionQuota(getQuotaContext(actor, existing), 1, "llm")).allowed, false);
    assert.equal((await rows("conversion_usage")).length, 0);
  });
}

test("AI refunds preserve concurrent local deductions", async (t) => {
  const existing = subscription();
  const { rows } = await setupD1(t, [existing]);
  const [{ getQuotaContext, consumeConversionQuota, releaseAiQuota }] = await modules;
  const context = getQuotaContext(actor, existing);
  await consumeConversionQuota(context, 3, "llm");
  await Promise.all([releaseAiQuota(context, 3), consumeConversionQuota(context, 2)]);
  assert.equal((await rows("conversion_usage"))[0].used_pages, 2);
  assert.equal((await rows("conversion_usage"))[0].used_ai_pages, 0);
});

test("renewal resets both counters and old AI refunds cannot change the new period", async (t) => {
  const existing = subscription();
  const { rows, db } = await setupD1(t, [existing]);
  const [{ getQuotaContext, consumeConversionQuota, releaseAiQuota }] = await modules;
  const old = getQuotaContext(actor, existing);
  await consumeConversionQuota(old, 5, "llm");
  await db.prepare("UPDATE billing_subscriptions SET current_period_start = ?, current_period_end = ?")
    .bind(new Date(Date.now() - 3_600_000).toISOString(), new Date(Date.now() + 30 * day).toISOString()).run();
  const current = getQuotaContext(actor, (await rows<BillingSubscription>("billing_subscriptions"))[0]);
  await consumeConversionQuota(current, 2, "llm");
  await releaseAiQuota(old, 5);
  assert.equal((await rows("conversion_usage"))[0].used_pages, 2);
  assert.equal((await rows("conversion_usage"))[0].used_ai_pages, 2);
  const before = structuredClone((await rows("conversion_usage")));
  assert.equal((await consumeConversionQuota(old, 1, "llm")).status, "stale");
  assert.deepEqual((await rows("conversion_usage")), before);
});

test("account quota exposes AI remaining pages from the same billing window", async (t) => {
  const existing = subscription();
  await setupD1(t, [existing]);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const { getAccountSnapshot } = await import("@/lib/account/server");
  const context = getQuotaContext(actor, existing);
  await consumeConversionQuota(context, 30);
  await consumeConversionQuota(context, 10, "llm");
  const snapshot = await getAccountSnapshot({ id: actor.key, email: actor.email });
  assert.equal(snapshot.quota?.remainingPages, 960);
  assert.equal(snapshot.quota?.remainingAiPages, 190);
  assert.equal(snapshot.quota?.aiLimitPages, 200);
});

test("duplicate paid notifications advance the period only once", async (t) => {
  const existing = subscription({
    current_period_start: new Date(Date.now() - 31 * day).toISOString(),
    current_period_end: new Date(Date.now() - day).toISOString(),
  });
  const { rows } = await setupD1(t, [existing]);
  const [, { applyBillingEvent }] = await modules;
  const paid = notification("subscription-paid", "paid-1", existing, {
    periodStart: existing.current_period_end,
    periodEnd: new Date(Date.now() + 29 * day).toISOString(),
  });
  assert.equal(await applyBillingEvent(paid), "applied");
  const before = structuredClone((await rows("billing_subscriptions")));
  assert.equal(await applyBillingEvent(paid), "ignored");
  assert.deepEqual((await rows("billing_subscriptions")), before);
});

test("payment failure and same-period recovery keep the already consumed quota", async (t) => {
  const existing = subscription();
  const { rows } = await setupD1(t, [existing]);
  const [{ getQuotaContext, consumeConversionQuota }, { applyBillingEvent }] = await modules;
  await consumeConversionQuota(getQuotaContext(actor, existing), 7);
  const before = structuredClone((await rows("conversion_usage")));
  await applyBillingEvent(notification("subscription-status-changed", "failure", existing, { status: "PAYMENT_FAILED" }));
  assert.equal((await rows("billing_subscriptions"))[0].status, "PAYMENT_FAILED");
  await applyBillingEvent(notification("subscription-paid", "recovered", existing, { status: "ACTIVE" }));
  assert.equal((await rows("billing_subscriptions"))[0].status, "ACTIVE");
  assert.deepEqual((await rows("conversion_usage")), before);
});

test("concurrent payment and older cancellation require a retry and preserve cancellation", async (t) => {
  const existing = subscription({
    current_period_start: new Date(Date.now() - 31 * day).toISOString(),
    current_period_end: new Date(Date.now() - day).toISOString(),
  });
  const { rows } = await setupD1(t, [existing]);
  const [, { applyBillingEvent }] = await modules;
  const periodEnd = new Date(Date.now() + 29 * day).toISOString();
  const events = [
    notification("subscription-paid", "renewal", existing, { status: "ACTIVE", periodStart: existing.current_period_end, periodEnd }),
    notification("subscription-cancelled", "cancel", existing, { status: "CANCELLED" }, new Date(Date.now() - 1000).toISOString()),
  ];
  const results = await Promise.allSettled(events.map((event) => applyBillingEvent(event)));
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  for (const [index, result] of results.entries()) {if (result.status === "rejected") {await applyBillingEvent(events[index]);}}
  assert.equal((await rows("billing_subscriptions"))[0].status, "CANCELLED");
  assert.equal((await rows("billing_subscriptions"))[0].current_period_end, periodEnd);
});

test("payment notifications cannot change the owner or resurrect an expired subscription", async (t) => {
  const existing = subscription();
  const { rows, db } = await setupD1(t, [existing]);
  const [, { applyBillingEvent }] = await modules;
  await assert.rejects(applyBillingEvent(notification("subscription-paid", "wrong-owner", existing, { userId: "another-user" })));
  assert.equal((await rows("billing_subscriptions"))[0].last_webhook_event_id, existing.last_webhook_event_id);
  await db.prepare("UPDATE billing_subscriptions SET status = 'EXPIRED'").run();
  assert.equal(await applyBillingEvent(notification("subscription-paid", "late", existing)), "ignored");
  assert.equal((await rows("billing_subscriptions"))[0].status, "EXPIRED");
});

test("USD cents stay exact and reject unsafe, negative or over-precision inputs", async () => {
  const [, , { usdFromDecimal, usdFromMinorUnits, usdToDecimal }] = await modules;
  assert.equal(usdFromDecimal("49.90"), 4990);
  assert.equal(usdToDecimal(usdFromDecimal("0")), "0.00");
  for (const value of ["-1", "1.001", " 1", "1e2", "9007199254740991"]) {assert.throws(() => usdFromDecimal(value));}
  for (const value of [-1, 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1]) {assert.throws(() => usdFromMinorUnits(value));}
});
