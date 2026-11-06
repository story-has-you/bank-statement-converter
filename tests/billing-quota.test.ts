import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test, type TestContext } from "node:test";

import type { BillingEvent, BillingNotification, ProviderSubscription } from "@/lib/billing/provider";
import type { BillingSubscription } from "@/lib/billing/server";

registerHooks({
  resolve(specifier, context, next) {
    return specifier === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    return url === "data:text/javascript,export{}" ? { format: "module", source: "export{}", shortCircuit: true } : next(url, context);
  },
});

// Use the real Supabase client and application modules; replace only the HTTP transport.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://billing-test.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-public-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";

const modules = Promise.all([
  import("@/lib/usage/server"),
  import("@/lib/billing/events"),
  import("@/lib/billing/usd"),
]);
type Row = Record<string, unknown>;
const actor = { type: "user" as const, key: "00000000-0000-4000-8000-000000000001", email: "fixture@example.invalid" };
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
    last_webhook_event_id: null,
    last_event_at: null,
    created_at: new Date(Date.now() - day).toISOString(),
    ...changes,
  };
}

function setup(t: TestContext, subscriptions: BillingSubscription[] = []) {
  const tables: Record<string, Row[]> = {
    conversion_usage: [],
    billing_subscriptions: structuredClone(subscriptions),
    billing_subscription_intents: [],
  };
  const state = { casMisses: 0, insertConflicts: 0, failWrites: false };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, "https://billing-test.invalid", "Tests must never call a real service");
    const table = url.pathname.split("/").at(-1)!;
    assert(Object.hasOwn(tables, table), `Unexpected database resource: ${url.pathname}`);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (state.failWrites && method !== "GET") return json({ code: "FIXTURE_FAILURE", message: "Fixture write failed" }, 500);
    const matches = (row: Row) =>
      [...url.searchParams].every(([key, value]) => {
        if (["select", "order", "limit"].includes(key)) return true;
        if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
        if (value.startsWith("is.")) return row[key] === null && value === "is.null";
        if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[key]));
        throw new Error(`Unexpected filter: ${key}=${value}`);
      });
    let selected = tables[table].filter(matches);
    if (method === "POST") {
      const row: Row = JSON.parse(String(init?.body));
      const duplicate = tables[table].some((existing) =>
        table === "conversion_usage"
          ? existing.actor_type === row.actor_type && existing.actor_key === row.actor_key
          : existing.provider === row.provider && existing.provider_subscription_id === row.provider_subscription_id,
      );
      if (duplicate) {
        state.insertConflicts++;
        return json({ code: "23505", message: "Fixture unique constraint" }, 409);
      }
      tables[table].push(row);
      selected = [row];
    } else if (method === "PATCH") {
      if (!selected.length) state.casMisses++;
      const changes: Row = JSON.parse(String(init?.body));
      selected.forEach((row) => Object.assign(row, changes));
    } else {
      assert.equal(method, "GET");
    }
    if (url.searchParams.has("limit")) selected = selected.slice(0, Number(url.searchParams.get("limit")));
    if (method !== "GET" && !headers.get("prefer")?.includes("return=representation")) return new Response(null, { status: 204 });
    return json(headers.get("accept")?.includes("application/vnd.pgrst.object+json") ? (selected[0] ?? null) : selected);
  });
  return { tables, state };
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
          }
        : { ...base, type };
    },
  };
}

test("real quota insert contention admits only the pages that fit", async (t) => {
  const { tables, state } = setup(t);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const context = getQuotaContext(actor, null);
  const results = await Promise.all([consumeConversionQuota(context, 3), consumeConversionQuota(context, 3)]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["consumed", "exceeded"]);
  assert.equal(tables.conversion_usage[0].used_pages, 3);
  assert.equal(state.insertConflicts, 1);
});

test("real quota CAS retries a lost update instead of losing a deduction", async (t) => {
  const { tables, state } = setup(t);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const context = getQuotaContext(actor, null);
  await consumeConversionQuota(context, 1);
  const results = await Promise.all([consumeConversionQuota(context, 2), consumeConversionQuota(context, 2)]);
  assert(results.every((result) => result.allowed));
  assert.equal(tables.conversion_usage[0].used_pages, 5);
  assert(state.casMisses > 0);
});

test("a stale billing window cannot overwrite usage in a renewed window", async (t) => {
  const original = subscription();
  const { tables } = setup(t, [original]);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const old = getQuotaContext(actor, original);
  Object.assign(tables.billing_subscriptions[0], {
    current_period_start: new Date(Date.now() - 3_600_000).toISOString(),
    current_period_end: new Date(Date.now() + 30 * day).toISOString(),
  });
  const current = getQuotaContext(actor, tables.billing_subscriptions[0] as BillingSubscription);
  await consumeConversionQuota(current, 7);
  const before = structuredClone(tables.conversion_usage);
  assert.equal((await consumeConversionQuota(old, 2)).status, "stale");
  assert.deepEqual(tables.conversion_usage, before);
});

test("failed quota writes reject and invalid page counts never deduct", async (t) => {
  const { tables, state } = setup(t);
  const [{ getQuotaContext, consumeConversionQuota }] = await modules;
  const context = getQuotaContext(actor, null);
  for (const pages of [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(consumeConversionQuota(context, pages));
  state.failWrites = true;
  await assert.rejects(consumeConversionQuota(context, 1));
  assert.equal(tables.conversion_usage.length, 0);
});

test("duplicate paid notifications advance the period only once", async (t) => {
  const existing = subscription({
    current_period_start: new Date(Date.now() - 31 * day).toISOString(),
    current_period_end: new Date(Date.now() - day).toISOString(),
  });
  const { tables } = setup(t, [existing]);
  const [, { applyBillingEvent }] = await modules;
  const paid = notification("subscription-paid", "paid-1", existing, {
    periodStart: existing.current_period_end,
    periodEnd: new Date(Date.now() + 29 * day).toISOString(),
  });
  assert.equal(await applyBillingEvent(paid), "applied");
  const before = structuredClone(tables.billing_subscriptions);
  assert.equal(await applyBillingEvent(paid), "ignored");
  assert.deepEqual(tables.billing_subscriptions, before);
});

test("payment failure and same-period recovery keep the already consumed quota", async (t) => {
  const existing = subscription();
  const { tables } = setup(t, [existing]);
  const [{ getQuotaContext, consumeConversionQuota }, { applyBillingEvent }] = await modules;
  await consumeConversionQuota(getQuotaContext(actor, existing), 7);
  const before = structuredClone(tables.conversion_usage);
  await applyBillingEvent(notification("subscription-status-changed", "failure", existing, { status: "PAYMENT_FAILED" }));
  assert.equal(tables.billing_subscriptions[0].status, "PAYMENT_FAILED");
  await applyBillingEvent(notification("subscription-paid", "recovered", existing, { status: "ACTIVE" }));
  assert.equal(tables.billing_subscriptions[0].status, "ACTIVE");
  assert.deepEqual(tables.conversion_usage, before);
});

test("concurrent payment and older cancellation require a retry and preserve cancellation", async (t) => {
  const existing = subscription({
    current_period_start: new Date(Date.now() - 31 * day).toISOString(),
    current_period_end: new Date(Date.now() - day).toISOString(),
  });
  const { tables, state } = setup(t, [existing]);
  const [, { applyBillingEvent }] = await modules;
  const periodEnd = new Date(Date.now() + 29 * day).toISOString();
  const events = [
    notification("subscription-paid", "renewal", existing, { status: "ACTIVE", periodStart: existing.current_period_end, periodEnd }),
    notification("subscription-cancelled", "cancel", existing, { status: "CANCELLED" }, new Date(Date.now() - 1000).toISOString()),
  ];
  const results = await Promise.allSettled(events.map(applyBillingEvent));
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(state.casMisses, 1);
  for (const [index, result] of results.entries()) if (result.status === "rejected") await applyBillingEvent(events[index]);
  assert.equal(tables.billing_subscriptions[0].status, "CANCELLED");
  assert.equal(tables.billing_subscriptions[0].current_period_end, periodEnd);
});

test("payment notifications cannot change the owner or resurrect an expired subscription", async (t) => {
  const existing = subscription();
  const { tables } = setup(t, [existing]);
  const [, { applyBillingEvent }] = await modules;
  await assert.rejects(applyBillingEvent(notification("subscription-paid", "wrong-owner", existing, { userId: "another-user" })));
  assert.deepEqual(tables.billing_subscriptions[0], existing);
  tables.billing_subscriptions[0].status = "EXPIRED";
  assert.equal(await applyBillingEvent(notification("subscription-paid", "late", existing)), "ignored");
  assert.equal(tables.billing_subscriptions[0].status, "EXPIRED");
});

test("USD cents stay exact and reject unsafe, negative or over-precision inputs", async () => {
  const [, , { usdFromDecimal, usdFromMinorUnits, usdToDecimal }] = await modules;
  assert.equal(usdFromDecimal("49.90"), 4990);
  assert.equal(usdToDecimal(usdFromDecimal("0")), "0.00");
  for (const value of ["-1", "1.001", " 1", "1e2", "9007199254740991"]) assert.throws(() => usdFromDecimal(value));
  for (const value of [-1, 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => usdFromMinorUnits(value));
});
