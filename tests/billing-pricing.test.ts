import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { registerHooks } from "node:module";
import { test, type TestContext } from "node:test";
import { subscriptionConfig } from "@/config/plans";
import { brandConfig } from "@/config/brand";
import englishMessages from "../messages/en.json";
import { setupD1 } from "./helpers/d1";
import type { BillingSubscription } from "@/lib/billing/server";
import type { WaffoSubscription, WaffoPayment } from "@/lib/billing/providers/waffo/server";

registerHooks({ resolve(specifier, context, next) {
  if (specifier === "@/lib/auth/server" || specifier === "@clerk/nextjs/server") {return { url: "data:text/javascript,billing-auth-fixture", shortCircuit: true };}
  if (specifier === "@/lib/db/server") {return { url: "data:text/javascript,billing-db-fixture", shortCircuit: true };}
  if (specifier === "next/server") {return { url: "data:text/javascript,billing-next-fixture", shortCircuit: true };}
  if (specifier === "next-intl/server") {return { url: "data:text/javascript,billing-i18n-fixture", shortCircuit: true };}
  return specifier === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(specifier, context);
}, load(url, context, next) {
  if (url === "data:text/javascript,billing-auth-fixture") {return {
    format: "module", shortCircuit: true,
    source: `const user = { id: "user_billingFixture", email: "buyer@example.invalid" };
      export const getAccountUser = async () => user;
      export const getSession = async () => ({ userId: user.id });
      export const getVerifiedEmail = (account) => account.email;
      export const clerkClient = async () => ({ users: { getUser: async (id) => {
        if (id !== user.id) throw new Error("Fixture Clerk account missing");
        return user;
      } } });`,
  };}
  if (url === "data:text/javascript,billing-db-fixture") {return { format: "module", source: "export const getDatabase = () => globalThis.testDatabase;", shortCircuit: true };}
  if (url === "data:text/javascript,billing-next-fixture") {return { format: "module", source: `export class NextResponse extends Response {} export function after(callback) { if (globalThis.billingAfter) globalThis.billingAfter.push(callback); }`, shortCircuit: true };}
  if (url === "data:text/javascript,billing-i18n-fixture") {return { format: "module", source: "export async function getTranslations() { return key => key; }", shortCircuit: true };}
  return url === "data:text/javascript,export{}" ? { format: "module", source: "export{}", shortCircuit: true } : next(url, context);
} });
const user = { id: "user_billingFixture", email: "buyer@example.invalid" };
const attemptId = "00000000-0000-4000-8000-000000000002";
const otherAttempt = "00000000-0000-4000-8000-000000000003";
const productId = "PROD_0123456789012345678901";
Object.assign(process.env, {
  NEXT_PUBLIC_GA4_TEST_MEASUREMENT_ID: "G-STATEMENTXLTEST",
  BILLING_QUOTE_SIGNING_SECRET: "fixture-quote-signing-key-at-least-32-bytes", WAFFO_PAYMENT_ENABLED: "true",
  WAFFO_PRODUCT_ID_STANDARD: productId, WAFFO_PRODUCT_ID_PROFESSIONAL: "PROD_1123456789012345678901",
  WAFFO_PRODUCT_ID_ENTERPRISE: "PROD_2123456789012345678901", WAFFO_ENVIRONMENT: "test",
  WAFFO_STORE_ID: "fixture-store", WAFFO_MERCHANT_ID: "MER_0123456789012345678901", WAFFO_RETURN_BASE_URL: "https://site.example.invalid",
  WAFFO_PRIVATE_KEY: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
});
test("Waffo return URL allows HTTP in development and requires HTTPS otherwise", async (t) => {
  const previousEnv = { ...process.env };
  t.after(() => { process.env = previousEnv; });
  const { getWaffoConfig } = await import("@/lib/billing/providers/waffo/config");
  for (const [environment, url, expected] of [
    ["development", "http://localhost:3000", true],
    ["development", "http://127.0.0.1:3000", true],
    ["development", "https://site.example.invalid", true],
    ["production", "http://localhost:3000", false],
    ["production", "https://site.example.invalid", true],
    ["test", "http://localhost:3000", false],
    ["development", "not-a-url", false],
    ["development", "javascript:alert(1)", false],
  ] as const) {
    Object.assign(process.env, { NODE_ENV: environment, WAFFO_RETURN_BASE_URL: url });
    assert.equal(Boolean(getWaffoConfig()), expected, `${environment}: ${url}`);
  }
  Object.assign(process.env, { NODE_ENV: "development", WAFFO_RETURN_BASE_URL: "http://localhost:3000" });
  delete process.env.WAFFO_MERCHANT_ID;
  assert.equal(getWaffoConfig(), null);
});

type Row = Record<string, unknown>;
const now = Date.now();
function stored(changes: Partial<BillingSubscription> = {}): BillingSubscription {
  return { id: "stored-subscription", user_id: user.id, email: user.email, tier: "standard", provider: "waffo",
    provider_subscription_id: "ORD_fixture", provider_plan_id: productId, status: "ACTIVE", amount: 19.9,
    original_amount: 19.9, recurring_amount_usd: 19.9, discount_amount: 0, provider_discount_id: null, currency_code: "USD",
    payer_id: null, subscriber_email: user.email, current_period_start: new Date(now - 86400000).toISOString(),
    current_period_end: new Date(now + 29 * 86400000).toISOString(), last_event_at: null, last_webhook_event_id: null,
    created_at: new Date(now).toISOString(), ...changes };
}
function waffoRemote(): WaffoSubscription {
  return { id: "ORD_fixture", metadata: null, storeId: "fixture-store", testMode: true, buyerEmail: user.email, merchantProvidedBuyerIdentity: user.id,
    orderMerchantExternalId: `wco_${attemptId}`, status: "active", billingPeriod: "monthly", isInTrial: false,
    currentPeriodStart: new Date(now - 86400000).toISOString(), currentPeriodEnd: new Date(now + 29 * 86400000).toISOString(),
    currentPeriodNumber: 1, subscriptionProduct: { id: productId },
    priceSnapshot: { currency: "USD", regularPhase: { subtotal: "19.90", total: "21.89", taxAmount: "1.99" } }, discount: null };
}
function waffoPayment(): WaffoPayment {
  return { id: "PAY_fixture", orderId: "ORD_fixture", orderMerchantExternalId: `wco_${attemptId}`, testMode: true,
    status: "succeeded", periodNumber: 1, pspAmountDetails: { amount: "21.89", currency: "USD" },
    snapshotAmountDetails: { subtotal: "19.90", total: "21.89", listTotal: "21.89", discountAmount: "0.00", taxAmount: "1.99", currency: "USD" }, createdAt: new Date(now).toISOString() };
}
async function setup(t: TestContext, subscriptions: BillingSubscription[] = []) {
  const fixture = await setupD1(t, subscriptions);
  const calls: { url: URL; body: Row; method: string }[] = [];
  const state = { orders: [waffoRemote()], payment: waffoPayment(), failCreate: false, copySyncFails: false,
    copySyncMismatch: false, analyticsTimeout: false,
    beforeCreate: undefined as ((body: Row) => Promise<void>) | undefined };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init?.method ?? "GET";
    const body = init?.body && !url.pathname.endsWith("token") ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body, method });
    const json = (data: unknown, status = 200) => Response.json(data, { status });
    if (url.origin === "https://www.google-analytics.com") {
      if (state.analyticsTimeout) {throw new DOMException("Fixture timeout", "TimeoutError");}
      return new Response(null, { status: 204 });
    }
    assert.equal(url.origin, "https://api.waffo.ai", "Tests never call real services");
    if (url.pathname.endsWith("subscription-product/update-product")) {
      if (state.copySyncFails) {return json({ errors: [{ message: "Fixture sync failed" }] }, 502);}
      return json({ data: { product: { id: body.id, storeId: "fixture-store", billingPeriod: "monthly",
        name: state.copySyncMismatch ? "Incorrect name" : body.name, description: body.description } } });
    }
    if (url.pathname.endsWith("issue-session-token")) {return json({ data: { token: "fixture-token", expiresAt: new Date(now + 3600000).toISOString() } });}
    if (url.pathname.endsWith("create-session")) {
      if (state.beforeCreate) {await state.beforeCreate(body);}
      if (state.failCreate) {throw new Error("Fixture timeout");}
      return json({ data: { sessionId: "session-fixture", checkoutUrl: "https://checkout.waffo.ai/fixture", expiresAt: new Date(now + 3600000).toISOString() } });
    }
    if (url.pathname === "/v1/graphql") {
      const query = String(body.query);
      return json({ data: query.includes("subscriptionOrders(") ? { subscriptionOrders: state.orders }
        : query.includes("payment(id:") ? { payment: state.payment } : { subscriptionOrder: state.orders[0] } });
    }
    assert.fail(`Unexpected Waffo request ${url}`);
  });
  return { ...fixture, calls, state };
}

test("Waffo reconciles locked subtotal and real tax-inclusive payment, rejecting mismatches", async (t) => {
  await setup(t);
  const { verifyWaffoPayment } = await import("@/lib/billing/providers/waffo/subscription");
  assert.equal(verifyWaffoPayment(waffoRemote(), waffoPayment(), "19.90").amount, "21.89");
  for (const mutate of [
    (remote: WaffoSubscription, paid: WaffoPayment) => { paid.pspAmountDetails.amount = "19.90"; },
    (remote: WaffoSubscription, paid: WaffoPayment) => { paid.snapshotAmountDetails.taxAmount = "0.01"; },
    (remote: WaffoSubscription, paid: WaffoPayment) => { paid.snapshotAmountDetails.currency = "EUR"; },
    (remote: WaffoSubscription, paid: WaffoPayment) => { paid.orderId = "ORD_other"; },
    (remote: WaffoSubscription, paid: WaffoPayment) => { paid.periodNumber = 2; },
    (remote: WaffoSubscription) => { remote.isInTrial = true; },
    (remote: WaffoSubscription) => { remote.merchantProvidedBuyerIdentity = "invalid"; },
  ]) {
    const remote = waffoRemote(); const paid = waffoPayment(); mutate(remote, paid);
    assert.throws(() => verifyWaffoPayment(remote, paid, "19.90"));
  }
  assert.throws(() => verifyWaffoPayment(waffoRemote(), waffoPayment(), "9.90"));
});

test("Waffo rejects missing and invalid webhook signatures", async (t) => {
  await setup(t);
  const { parseWaffoWebhook } = await import("@/lib/billing/providers/waffo/webhook");
  await assert.rejects(parseWaffoWebhook(new Headers(), "{}"));
  await assert.rejects(parseWaffoWebhook(new Headers({ "x-waffo-signature": "invalid" }), "{}"));
});

test("Waffo verifies full and partial discounts from remote payment evidence", async (t) => {
  await setup(t);
  const { verifyWaffoPayment } = await import("@/lib/billing/providers/waffo/subscription");
  const remote = waffoRemote();
  remote.discount = { couponId: "coupon-fixture" };
  const full = waffoPayment();
  Object.assign(full.snapshotAmountDetails, { total: "0.00", discountAmount: "21.89", taxAmount: "0.00" });
  full.pspAmountDetails.amount = "0.00";
  assert.deepEqual(verifyWaffoPayment(remote, full, "19.90"), {
    amount: "0.00", paidAt: full.createdAt, originalAmount: "21.89", discountAmount: "21.89", providerDiscountId: "coupon-fixture",
  });
  const partial = waffoPayment();
  Object.assign(partial.snapshotAmountDetails, { total: "11.00", discountAmount: "10.89", taxAmount: "1.00" });
  partial.pspAmountDetails.amount = "11.00";
  assert.equal(verifyWaffoPayment(remote, partial, "19.90").discountAmount, "10.89");
  assert.equal(verifyWaffoPayment(remote, waffoPayment(), "19.90").providerDiscountId, null);
  for (const mutate of [
    (order: WaffoSubscription) => { order.discount = null; },
    (order: WaffoSubscription) => { order.discount!.couponId = " "; },
    (order: WaffoSubscription, payment: WaffoPayment) => { payment.snapshotAmountDetails.discountAmount = "21.90"; },
    (order: WaffoSubscription, payment: WaffoPayment) => { payment.snapshotAmountDetails.discountAmount = "0.00"; },
    (order: WaffoSubscription, payment: WaffoPayment) => { payment.snapshotAmountDetails.listTotal = "19.90"; },
    (order: WaffoSubscription, payment: WaffoPayment) => { payment.snapshotAmountDetails.subtotal = "0.00"; },
    (order: WaffoSubscription, payment: WaffoPayment) => { payment.snapshotAmountDetails.taxAmount = "0.01"; },
    (order: WaffoSubscription, payment: WaffoPayment) => { payment.pspAmountDetails.amount = "0.01"; },
  ]) {
    const order = structuredClone(remote); const payment = structuredClone(full); mutate(order, payment);
    assert.throws(() => verifyWaffoPayment(order, payment, "19.90"));
  }
});

test("signed zero-dollar Waffo webhook stores the discount once and keeps the recurring price", async (t) => {
  const { rows, calls, state, db } = await setup(t);
  const { createCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const { handleBillingWebhook } = await import("@/lib/billing/http");
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const previousKey = process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY;
  t.after(() => {
    if (previousKey === undefined) {delete process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY;}
    else {process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY = previousKey;}
  });
  process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const remote = state.orders[0];
  remote.subscriptionProduct = { id: process.env.WAFFO_PRODUCT_ID_PROFESSIONAL! };
  remote.priceSnapshot!.regularPhase = { subtotal: "24.90", total: "24.90", taxAmount: "0.00" };
  remote.discount = { couponId: "coupon-fixture" };
  remote.metadata = JSON.stringify(createCheckoutQuote({ ...quoteIdentity(), tier: "professional", productId: remote.subscriptionProduct.id }, "24.90"));
  Object.assign(state.payment.snapshotAmountDetails, { subtotal: "24.90", total: "0.00", listTotal: "24.90", discountAmount: "24.90", taxAmount: "0.00" });
  state.payment.pspAmountDetails.amount = "0.00";
  const event = { id: "event-discounted", eventId: state.payment.id, eventType: "subscription.payment_succeeded",
    timestamp: new Date(now).toISOString(), mode: "test", storeId: "fixture-store", data: {
      orderId: remote.id, paymentId: state.payment.id, periodNumber: 1, currency: "USD", chargedAmount: "0.00", paymentStatus: "succeeded",
      merchantProvidedBuyerIdentity: user.id, orderMerchantExternalId: remote.orderMerchantExternalId,
    } };
  const send = () => {
    const body = JSON.stringify(event);
    const timestamp = String(Date.now());
    const signature = sign("RSA-SHA256", Buffer.from(`${timestamp}.${body}`), keys.privateKey).toString("base64");
    return handleBillingWebhook(new Request("https://site.example.invalid/api/billing/webhooks/waffo", {
      method: "POST", body, headers: { "x-waffo-signature": `t=${timestamp},v1=${signature}` },
    }), "waffo");
  };
  event.data.chargedAmount = "0.01";
  assert.equal((await send()).status, 502);
  assert.equal((await rows("billing_subscriptions")).length, 0);
  event.data.chargedAmount = "0.00";
  const errorLog = t.mock.method(console, "error", () => {});
  await db.prepare("CREATE TRIGGER test_subscription_failure BEFORE INSERT ON billing_subscriptions BEGIN SELECT RAISE(ABORT, 'private payment data'); END").run();
  const failed = await send();
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), { error: "webhookProcessingFailed" });
  assert.deepEqual(errorLog.mock.calls[0].arguments, ["Failed to process billing webhook", {
    provider: "waffo", reason: "WEBHOOK_PROCESSING_FAILED", eventId: event.id, subscriptionId: remote.id,
  }]);
  assert.equal((await rows("billing_subscriptions")).length, 0);
  await db.prepare("DROP TRIGGER test_subscription_failure").run();
  const response = await send();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
  let row = (await rows("billing_subscriptions"))[0];
  assert.equal(row.amount, 0);
  assert.equal(row.original_amount, 24.9);
  assert.equal(row.discount_amount, 24.9);
  assert.equal(row.provider_discount_id, "coupon-fixture");
  assert.equal(row.recurring_amount_usd, 24.9);
  assert.equal(row.status, "ACTIVE");
  const before = calls.length;
  assert.equal((await send()).status, 200);
  assert.equal(calls.length, before);
  assert.equal((await rows("billing_subscriptions")).length, 1);
  assert(calls.some((call) => String(call.body.query).includes("listTotal discountAmount")));
  const renewalStart = Date.parse(remote.currentPeriodEnd!);
  t.mock.method(Date, "now", () => renewalStart + 1000);
  remote.currentPeriodNumber = 2;
  remote.currentPeriodStart = new Date(renewalStart).toISOString();
  remote.currentPeriodEnd = new Date(renewalStart + 30 * 86400000).toISOString();
  Object.assign(state.payment, { id: "PAY_renewal", periodNumber: 2, createdAt: remote.currentPeriodStart });
  Object.assign(state.payment.snapshotAmountDetails, { total: "24.90", discountAmount: "0.00" });
  state.payment.pspAmountDetails.amount = "24.90";
  Object.assign(event, { id: "event-renewal", eventId: state.payment.id, timestamp: remote.currentPeriodStart });
  Object.assign(event.data, { paymentId: state.payment.id, periodNumber: 2, chargedAmount: "24.90" });
  assert.equal((await send()).status, 200);
  row = (await rows("billing_subscriptions"))[0];
  assert.equal(row.current_period_end, remote.currentPeriodEnd);
  assert.equal(row.amount, 0);
  assert.equal(row.original_amount, 24.9);
  assert.equal(row.discount_amount, 24.9);
  assert.equal(row.provider_discount_id, "coupon-fixture");
  assert.equal(row.recurring_amount_usd, 24.9);
});


test("authenticated checkout and signed Waffo callbacks send one attributed first purchase", async (t) => {
  const { rows, calls, state, insertRow } = await setup(t);
  const { handleBillingWebhook, handleSubscriptionRequest } = await import("@/lib/billing/http");
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = { ...process.env };
  const queue = globalThis as typeof globalThis & { billingAfter?: (() => Promise<void>)[] };
  queue.billingAfter = [];
  t.after(() => {
    process.env = env;
    delete queue.billingAfter;
  });
  process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET = "fixture-only";
  process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const remote = state.orders[0];
  const checkout = () => handleSubscriptionRequest(new Request("https://site.example.invalid/api/billing/subscriptions/create", {
    method: "POST",
    headers: { origin: "https://site.example.invalid", "content-type": "application/json", "x-app-locale": "fr" },
    body: JSON.stringify({ provider: "waffo", tier: "standard", analytics: { clientId: "12345.67890", sessionId: 1234567, email: "excluded@example.invalid" } }),
  }), "create");

  state.failCreate = true;
  t.mock.method(console, "error", () => {});
  assert.equal((await checkout()).status, 502);
  assert.equal((await rows("billing_checkout_analytics")).length, 0);
  state.failCreate = false;
  await insertRow("billing_checkout_analytics", { checkout_id: "expired", client_id: "1.2", session_id: 123, locale: "en", created_at: "2000-01-01T00:00:00.000Z" });
  const created = await checkout();
  assert.equal(created.status, 200);
  const { checkoutId } = (await created.json()) as { checkoutId: string };
  const request = calls.filter((call) => call.url.pathname.endsWith("create-session")).at(-1)!;
  assert(!JSON.stringify(request.body).includes("12345.67890"));
  assert.equal((await rows("billing_checkout_analytics")).length, 1);
  assert.equal((await rows("billing_checkout_analytics"))[0].checkout_id, checkoutId);
  assert.equal(Object.hasOwn((await rows("billing_checkout_analytics"))[0], "email"), false);

  remote.orderMerchantExternalId = checkoutId;
  remote.metadata = JSON.stringify(request.body.metadata);
  const subtotal = subscriptionConfig.standard.monthlyPrice;
  const tax = 1.99;
  const amount = (subtotal + tax).toFixed(2);
  remote.priceSnapshot!.regularPhase = { subtotal: subtotal.toFixed(2), total: amount, taxAmount: tax.toFixed(2) };
  state.payment.orderMerchantExternalId = checkoutId;
  state.payment.pspAmountDetails.amount = amount;
  Object.assign(state.payment.snapshotAmountDetails, { subtotal: subtotal.toFixed(2), listTotal: amount, total: amount });
  const event = { id: "event-purchase", eventId: state.payment.id, eventType: "subscription.payment_succeeded",
    timestamp: new Date(now).toISOString(), mode: "test", storeId: "fixture-store", data: {
      orderId: remote.id, paymentId: state.payment.id, periodNumber: 1, currency: "USD", chargedAmount: amount, paymentStatus: "succeeded",
      merchantProvidedBuyerIdentity: user.id, orderMerchantExternalId: checkoutId,
    } };
  const send = () => {
    const body = JSON.stringify(event);
    const timestamp = String(Date.now());
    const signature = sign("RSA-SHA256", Buffer.from(`${timestamp}.${body}`), keys.privateKey).toString("base64");
    return handleBillingWebhook(new Request("https://site.example.invalid/api/billing/webhooks/waffo", {
      method: "POST", body, headers: { "x-waffo-signature": `t=${timestamp},v1=${signature}` },
    }), "waffo");
  };

  assert.deepEqual((await Promise.all([send(), send(), send()])).map((res) => res.status), [200, 200, 200]);
  assert.equal((await rows("billing_subscriptions")).length, 1);
  assert.equal(queue.billingAfter.length, 1);
  assert.equal(calls.filter((call) => call.url.pathname === "/mp/collect").length, 0);
  await queue.billingAfter.shift()!();
  const requests = calls.filter((call) => call.url.pathname === "/mp/collect");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.searchParams.get("measurement_id"), "G-STATEMENTXLTEST");
  assert.deepEqual(requests[0].body, {
    client_id: "12345.67890", timestamp_micros: now * 1_000,
    events: [{ name: "purchase", params: {
      session_id: 1234567, debug_mode: true, engagement_time_msec: 1, transaction_id: "waffo:PAY_fixture",
      currency: "USD", value: subtotal, tax, locale: "fr", plan_tier: "standard", payment_provider: "waffo",
      items: [{ item_id: "standard", price: subtotal, quantity: 1 }],
    } }],
  });
  assert.equal((await rows("billing_checkout_analytics")).length, 0);
  assert.equal((await send()).status, 200);
  assert.equal(queue.billingAfter.length, 0);
});

test("GA4 delivery skips missing attribution and treats timeouts as non-blocking", async (t) => {
  const { rows, calls, state } = await setup(t);
  const previousSecret = process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET;
  t.after(() => {
    if (previousSecret === undefined) {delete process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET;}
    else {process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET = previousSecret;}
  });
  process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET = "fixture-only";
  const { reportFirstPurchase, saveCheckoutAttribution } = await import("@/lib/billing/analytics");
  const { normalizeWaffoSubscription } = await billingModules();
  const remote = state.orders[0];
  const payment = state.payment;
  const event = {
    provider: "waffo", id: "event-fixture", at: new Date(now).toISOString(), type: "subscription-paid",
    subscription: normalizeWaffoSubscription(remote), amount: payment.snapshotAmountDetails.total, recurringAmount: "19.90",
    originalAmount: payment.snapshotAmountDetails.total, discountAmount: "0.00", providerDiscountId: null, currencyCode: "USD", paidAt: payment.createdAt,
    payment: { id: payment.id, periodNumber: 1, checkoutId: payment.orderMerchantExternalId!, taxAmount: "1.99", testMode: true },
  } as const;
  await reportFirstPurchase(event);
  assert.equal(calls.some((call) => call.url.pathname === "/mp/collect"), false);
  const attribution = { clientId: "123.456", sessionId: 987 };
  await saveCheckoutAttribution(event.payment.checkoutId, "en", attribution, false);
  assert.equal((await rows("billing_checkout_analytics")).length, 0);
  await saveCheckoutAttribution(event.payment.checkoutId, "en", attribution, true);
  state.analyticsTimeout = true;
  const warning = t.mock.method(console, "warn", () => {});
  await reportFirstPurchase(event);
  assert.deepEqual(warning.mock.calls.map((call) => call.arguments), [["GA4_PURCHASE_DELIVERY_FAILED"]]);
  assert.equal((await rows("billing_checkout_analytics")).length, 1);
});

test("recurring price rejects missing, free, unsafe and fractional-cent amounts", async () => {
  const { requireRecurringAmount } = await import("@/lib/billing/usd");
  for (const value of [null, undefined, "0", -1, "1.001", "NaN", Infinity, "10000000000"]) {assert.throws(() => requireRecurringAmount(value));}
  assert.equal(requireRecurringAmount("9999999999.99"), "9999999999.99");
});

test("Waffo updates only product copy before creating its priced checkout", async (t) => {
  const { calls } = await setup(t);
  const { createWaffoCheckout } = await import("@/lib/billing/providers/waffo/server");
  const { getSubscriptionProductCopy } = await import("@/lib/billing/catalog");
  await createWaffoCheckout("standard", user, "https://site.example.invalid/billing/return", { id: attemptId, amount: "9.90" });
  const updateIndex = calls.findIndex((call) => call.url.pathname.endsWith("subscription-product/update-product"));
  assert.deepEqual(calls[updateIndex].body, { id: productId, ...getSubscriptionProductCopy("standard") });
  assert(updateIndex < calls.findIndex((call) => call.url.pathname.endsWith("create-session")));
});

test("product copy uses the website translations and rejects empty fields", async () => {
  const { getSubscriptionProductCopy } = await import("@/lib/billing/catalog");
  const source = englishMessages.UsageTiers.plans.standard;
  const original = { ...source };
  try {
    source.name = "Updated product";
    source.description = "Updated website description.";
    assert.deepEqual(getSubscriptionProductCopy("standard"), { name: `${brandConfig.name} ${source.name}`, description: source.description });
    for (const key of ["name", "description"] as const) {
      for (const value of ["   ", ""]) {
        source[key] = value;
        assert.throws(() => getSubscriptionProductCopy("standard"));
      }
      source[key] = original[key];
    }
  } finally {
    Object.assign(source, original);
  }
});

async function billingModules() {
  const [{ createSubscription }, { getPaymentProvider }, { getLockedSubscriptionAmount }, { normalizeWaffoSubscription, verifyWaffoPayment }] = await Promise.all([
    import("@/lib/billing/checkouts"), import("@/lib/billing/providers"), import("@/lib/billing/pricing"), import("@/lib/billing/providers/waffo/subscription"),
  ]);
  return { createSubscription, getPaymentProvider, getLockedSubscriptionAmount, normalizeWaffoSubscription, verifyWaffoPayment };
}

test("only Waffo is available; retired providers cannot purchase or return checkouts", async () => {
  const { getCheckoutConfigs, getPaymentProvider } = await import("@/lib/billing/providers");
  const { isCheckoutResult, readBillingResponse } = await import("@/lib/billing/response");
  assert.deepEqual(getCheckoutConfigs().map((checkout) => checkout.provider), ["waffo"]);
  for (const provider of ["paypal", "creem"]) {
    assert.throws(() => getPaymentProvider(provider));
    assert.equal(isCheckoutResult({ provider, checkoutId: "old", checkoutUrl: "https://example.invalid" }), false);
    assert.deepEqual(readBillingResponse({ pendingCheckout: { provider, tier: "standard" } }), { error: undefined, status: undefined, subscriptionId: undefined });
  }
});

test("Waffo checkout sends signed website price without a subscription write", async (t) => {
  const { calls, rows } = await setup(t);
  const { createSubscription, getPaymentProvider } = await billingModules();
  await createSubscription(getPaymentProvider("waffo"), "standard", user, "https://site.example.invalid/billing/return");
  const body = calls.find((call) => call.url.pathname.endsWith("create-session"))!.body;
  const metadata = body.metadata as Record<string, string>;
  const quote = JSON.parse(metadata.billingQuote);
  assert.equal(quote.amount, subscriptionConfig.standard.monthlyPrice.toFixed(2));
  assert.equal(quote.userId, user.id);
  assert.equal(body.orderMerchantExternalId, `wco_${quote.attemptId}`);
  assert.deepEqual(body.priceSnapshot, { amount: quote.amount, taxCategory: "saas" });
  assert.equal(body.withTrial, false);
  assert.equal((await rows("billing_subscriptions")).length, 0);
});

test("repeated and concurrent purchases across every tier leave no pending database data", async (t) => {
  const { rows, calls } = await setup(t);
  const { createSubscription, getPaymentProvider } = await billingModules();
  const tiers = ["standard", "professional", "enterprise", "standard", "professional", "enterprise"] as const;
  const results = await Promise.all(tiers.map((tier) => createSubscription(getPaymentProvider("waffo"), tier, user, "https://site.example.invalid/billing/return")));
  assert.equal(new Set(results.map((result) => result.checkoutId)).size, tiers.length);
  assert.equal((await rows("billing_subscriptions")).length, 0);
  assert.equal(calls.filter((call) => call.url.pathname.endsWith("create-session")).length, tiers.length);
});

test("a checkout timeout writes no pending data and does not block another attempt", async (t) => {
  const { rows, state } = await setup(t);
  const { createSubscription, getPaymentProvider } = await billingModules();
  state.failCreate = true;
  await assert.rejects(createSubscription(getPaymentProvider("waffo"), "standard", user, "https://site.example.invalid/billing/return"));
  state.failCreate = false;
  await createSubscription(getPaymentProvider("waffo"), "professional", user, "https://site.example.invalid/billing/return");
  assert.equal((await rows("billing_subscriptions")).length, 0);
});

test("old Waffo subscription verifies renewal at its locked price including tax", async (t) => {
  await setup(t, [stored()]);
  const { getLockedSubscriptionAmount, normalizeWaffoSubscription, verifyWaffoPayment } = await billingModules();
  const remote = waffoRemote();
  const price = await getLockedSubscriptionAmount("waffo", normalizeWaffoSubscription(remote), attemptId);
  assert.equal(price, "19.90");
  assert.equal(verifyWaffoPayment(remote, waffoPayment(), price).amount, "21.89");
});

test("first payment before checkout returns activates without creating a pending row", async (t) => {
  const { rows, state } = await setup(t);
  const { createSubscription, getPaymentProvider } = await billingModules();
  const { applyBillingEvent } = await import("@/lib/billing/events");
  state.beforeCreate = async (body) => {
    const remote = state.orders[0];
    remote.metadata = JSON.stringify(body.metadata);
    remote.orderMerchantExternalId = String(body.orderMerchantExternalId);
    const amount = (body.priceSnapshot as { amount: string }).amount;
    remote.priceSnapshot!.regularPhase = { subtotal: amount, total: amount, taxAmount: "0.00" };
    state.payment.orderMerchantExternalId = remote.orderMerchantExternalId;
    state.payment.snapshotAmountDetails = { subtotal: amount, total: amount, listTotal: amount, discountAmount: "0.00", taxAmount: "0.00", currency: "USD" };
    state.payment.pspAmountDetails.amount = amount;
    assert.equal(await applyBillingEvent(await paidNotification(remote, state.payment)), "applied");
  };
  await createSubscription(getPaymentProvider("waffo"), "standard", user, "https://site.example.invalid/billing/return");
  assert.equal(await applyBillingEvent(await paidNotification(state.orders[0], state.payment)), "ignored");
  assert.equal((await rows("billing_subscriptions")).length, 1);
  assert.equal((await rows("billing_subscriptions"))[0].recurring_amount_usd, subscriptionConfig.standard.monthlyPrice);
});

test("copy sync failure or mismatch prevents checkout creation and allows safe retry", async (t) => {
  const { calls, state } = await setup(t);
  const { createSubscription, getPaymentProvider } = await billingModules();
  for (const mode of ["copySyncFails", "copySyncMismatch"] as const) {
    state.copySyncFails = mode === "copySyncFails"; state.copySyncMismatch = mode === "copySyncMismatch";
    await assert.rejects(createSubscription(getPaymentProvider("waffo"), "standard", user, "https://site.example.invalid/billing/return"));
    assert.equal(calls.some((call) => call.url.pathname.endsWith("create-session")), false);
  }
});

test("HTTP checkout ignores forged price and product copy; unsupported APIs reject", async (t) => {
  const { calls } = await setup(t);
  const { handleSubscriptionRequest, handleBillingWebhook } = await import("@/lib/billing/http");
  const request = (provider: string) => new Request("https://site.example.invalid/api/billing/subscriptions/create", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://site.example.invalid" },
    body: JSON.stringify({ provider, tier: "standard", amount: "0.01", name: "Forged", description: "Forged", productId: "attacker-product", metadata: { billingQuote: "forged", billingQuoteSignature: "0".repeat(64) } }),
  });
  assert.equal((await handleSubscriptionRequest(request("waffo"), "create")).status, 200);
  const payload = calls.find((call) => call.url.pathname.endsWith("create-session"))!.body;
  const quote = JSON.parse((payload.metadata as Record<string, string>).billingQuote);
  assert.equal(quote.userId, user.id);
  assert.equal(quote.amount, subscriptionConfig.standard.monthlyPrice.toFixed(2));
  const { getSubscriptionProductCopy } = await import("@/lib/billing/catalog");
  assert.deepEqual(calls.find((call) => call.url.pathname.endsWith("update-product"))!.body, { id: productId, ...getSubscriptionProductCopy("standard") });
  assert.deepEqual(calls.find((call) => call.url.pathname.endsWith("create-session"))!.body.priceSnapshot, { amount: subscriptionConfig.standard.monthlyPrice.toFixed(2), taxCategory: "saas" });
  for (const provider of ["paypal", "creem"]) {
    for (const action of ["create", "activate", "cancel"] as const) {assert.equal((await handleSubscriptionRequest(request(provider), action)).status, 400);}
    assert.equal((await handleBillingWebhook(request(provider), provider)).status, 400);
  }
});

test("a signed old checkout pays its original price after switching plans and website pricing", async (t) => {
  const { rows } = await setup(t);
  const { createCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const { createSubscription, getPaymentProvider } = await billingModules();
  const { applyBillingEvent } = await import("@/lib/billing/events");
  const remote = waffoRemote();
  remote.metadata = JSON.stringify(createCheckoutQuote(quoteIdentity(), "19.90"));
  await createSubscription(getPaymentProvider("waffo"), "professional", user, "https://site.example.invalid/billing/return");
  const notification = await paidNotification(remote, waffoPayment());
  assert.equal(await applyBillingEvent(notification), "applied");
  assert.equal(await applyBillingEvent(notification), "ignored");
  assert.equal((await rows("billing_subscriptions")).length, 1);
  assert.equal((await rows("billing_subscriptions"))[0].tier, "standard");
  assert.equal((await rows("billing_subscriptions"))[0].recurring_amount_usd, 19.9);
});


function quoteIdentity() {
  return { attemptId, userId: user.id, tier: "standard" as const, productId, storeId: "fixture-store", environment: "test" as const };
}

async function paidNotification(remote: WaffoSubscription, payment: WaffoPayment) {
  const { getLockedSubscriptionAmount, normalizeWaffoSubscription, verifyWaffoPayment } = await billingModules();
  const subscription = normalizeWaffoSubscription(remote);
  return { provider: "waffo" as const, id: "event-paid", at: new Date(now).toISOString(), type: "subscription-paid" as const,
    subscriptionId: remote.id,
    async resolve() {
      const recurringAmount = await getLockedSubscriptionAmount("waffo", subscription, remote.orderMerchantExternalId!.slice(4), {
        metadata: remote.metadata, storeId: remote.storeId, environment: "test",
      });
      const verified = verifyWaffoPayment(remote, payment, recurringAmount);
      return { provider: "waffo" as const, id: "event-paid", at: new Date(now).toISOString(), type: "subscription-paid" as const,
        subscription, recurringAmount, ...verified, currencyCode: "USD",
        payment: { id: payment.id, periodNumber: payment.periodNumber!, checkoutId: remote.orderMerchantExternalId!, taxAmount: payment.snapshotAmountDetails.taxAmount, testMode: payment.testMode } };
    },
  };
}

test("missing or short signing secret blocks checkout before provider writes", async (t) => {
  const { calls } = await setup(t);
  const { createSubscription, getPaymentProvider } = await billingModules();
  const { getCheckoutConfigs } = await import("@/lib/billing/providers");
  const saved = process.env.BILLING_QUOTE_SIGNING_SECRET;
  try {
    for (const value of [undefined, "too-short"]) {
      if (value === undefined) {delete process.env.BILLING_QUOTE_SIGNING_SECRET;}
      else {process.env.BILLING_QUOTE_SIGNING_SECRET = value;}
      assert.equal(getCheckoutConfigs()[0].available, false);
      await assert.rejects(createSubscription(getPaymentProvider("waffo"), "standard", user, "https://site.example.invalid/billing/return"));
    }
    assert(calls.every((call) => call.method === "GET"));
  } finally {
    process.env.BILLING_QUOTE_SIGNING_SECRET = saved;
  }
});

test("signed quote validates every identity field and never expires a delayed legitimate payment", async () => {
  const { createCheckoutQuote, readCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const identity = quoteIdentity();
  const metadata = createCheckoutQuote(identity, "19.90");
  assert.equal(readCheckoutQuote(JSON.stringify(metadata), identity), "19.90");
  for (const changes of [
    { attemptId: otherAttempt }, { userId: otherAttempt }, { tier: "professional" as const },
    { productId: "PROD_other" }, { storeId: "other-store" }, { environment: "prod" as const },
  ]) {assert.throws(() => readCheckoutQuote(JSON.stringify(metadata), { ...identity, ...changes }));}
  const resign = (changes: Record<string, unknown>) => {
    const billingQuote = JSON.stringify({ ...JSON.parse(metadata.billingQuote), ...changes });
    return JSON.stringify({ billingQuote, billingQuoteSignature: createHmac("sha256", process.env.BILLING_QUOTE_SIGNING_SECRET!).update(billingQuote).digest("hex") });
  };
  for (const changes of [
    { version: 2 }, { currency: "EUR" }, { amount: "0.00" }, { amount: "1.001" }, { amount: "19.9" },
    { createdAt: "invalid" }, { createdAt: new Date(Date.now() + 120000).toISOString() },
  ]) {assert.throws(() => readCheckoutQuote(resign(changes), identity));}
  assert.equal(readCheckoutQuote(resign({ createdAt: "2020-01-01T00:00:00.000Z" }), identity), "19.90");
});

test("a first payment requires an unaltered signed quote", async (t) => {
  const { rows } = await setup(t);
  const { createCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const { getLockedSubscriptionAmount, normalizeWaffoSubscription } = await billingModules();
  const metadata = createCheckoutQuote(quoteIdentity(), "19.90");
  const remote = normalizeWaffoSubscription(waffoRemote());
  for (const invalid of [
    null, "{}", "{", "[]", "null", JSON.stringify({ billingQuote: metadata.billingQuote }),
    JSON.stringify({ billingQuoteSignature: metadata.billingQuoteSignature }),
    JSON.stringify({ ...metadata, billingQuoteSignature: "0".repeat(64) }),
    JSON.stringify({ ...metadata, billingQuote: metadata.billingQuote.replace("19.90", "0.01") }),
    JSON.stringify({ billingQuote: 123, billingQuoteSignature: "" }),
  ]) {await assert.rejects(getLockedSubscriptionAmount("waffo", remote, attemptId, { metadata: invalid, storeId: "fixture-store", environment: "test" }));}
  assert.equal((await rows("billing_subscriptions")).length, 0);
});

test("renewal uses its stored recurring price and rejects a conflicting signed quote", async (t) => {
  const { db, state } = await setup(t, [stored()]);
  const { createCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const { getLockedSubscriptionAmount, normalizeWaffoSubscription, verifyWaffoPayment } = await billingModules();
  state.orders[0].metadata = JSON.stringify(createCheckoutQuote(quoteIdentity(), "19.90"));
  const price = await getLockedSubscriptionAmount("waffo", normalizeWaffoSubscription(state.orders[0]), attemptId, {
    metadata: state.orders[0].metadata, storeId: "fixture-store", environment: "test",
  });
  assert.equal(price, "19.90");
  assert.equal(verifyWaffoPayment(state.orders[0], state.payment, price).amount, "21.89");
  await db.prepare("UPDATE billing_subscriptions SET recurring_amount_cents = 990").run();
  await assert.rejects(getLockedSubscriptionAmount("waffo", normalizeWaffoSubscription(state.orders[0]), attemptId, {
    metadata: state.orders[0].metadata, storeId: "fixture-store", environment: "test",
  }));
});

test("order evidence is reread with metadata and tampered payments never create subscriptions", async (t) => {
  const { rows, state, calls } = await setup(t);
  const { createCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const { getWaffoSubscription } = await import("@/lib/billing/providers/waffo/server");
  const { applyBillingEvent } = await import("@/lib/billing/events");
  state.orders[0].metadata = JSON.stringify(createCheckoutQuote(quoteIdentity(), "19.90"));
  const remote = await getWaffoSubscription("ORD_fixture");
  assert.equal(remote.metadata, state.orders[0].metadata);
  assert(calls.some((call) => call.url.pathname === "/v1/graphql" && String(call.body.query).includes("id metadata storeId")));
  for (const change of ["amount", "tax", "quote"] as const) {
    const order = structuredClone(remote);
    const payment = waffoPayment();
    if (change === "amount") {payment.pspAmountDetails.amount = "0.01";}
    if (change === "tax") {payment.snapshotAmountDetails.taxAmount = "0.00";}
    if (change === "quote") {order.metadata = JSON.stringify({ ...JSON.parse(order.metadata!), billingQuoteSignature: "1".repeat(64) });}
    await assert.rejects(applyBillingEvent(await paidNotification(order, payment)));
    assert.equal((await rows("billing_subscriptions")).length, 0);
  }
});

test("late canceled paid subscription is recorded alongside a newer active membership", async (t) => {
  const active = stored({ tier: "enterprise", provider_subscription_id: "ORD_business", provider_plan_id: process.env.WAFFO_PRODUCT_ID_ENTERPRISE! });
  const { rows } = await setup(t, [active]);
  const { createCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const { applyBillingEvent } = await import("@/lib/billing/events");
  const { selectEntitledSubscription } = await import("@/lib/billing/server");
  const remote = waffoRemote(); remote.status = "canceling";
  remote.metadata = JSON.stringify(createCheckoutQuote(quoteIdentity(), "19.90"));
  const paid = await paidNotification(remote, waffoPayment());
  assert.equal(await applyBillingEvent(paid), "applied");
  assert.equal(await applyBillingEvent(paid), "ignored");
  assert.equal((await rows("billing_subscriptions")).length, 2);
  assert.equal((await rows("billing_subscriptions"))[1].status, "CANCELLED");
  assert.equal(selectEntitledSubscription(await rows<BillingSubscription>("billing_subscriptions"))!.provider_subscription_id, "ORD_business");
});

test("a second active paid subscription still cannot replace the existing membership", async (t) => {
  const active = stored({ provider_subscription_id: "ORD_business" });
  const { rows } = await setup(t, [active]);
  const { createCheckoutQuote } = await import("@/lib/billing/checkout-quote");
  const { applyBillingEvent } = await import("@/lib/billing/events");
  const remote = waffoRemote(); remote.metadata = JSON.stringify(createCheckoutQuote(quoteIdentity(), "19.90"));
  await assert.rejects(applyBillingEvent(await paidNotification(remote, waffoPayment())));
  assert.equal((await rows("billing_subscriptions")).length, 1);
});
