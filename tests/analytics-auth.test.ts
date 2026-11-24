import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { setupD1 } from "./helpers/d1";

const createdAt = Date.now() - 180_000;
const fixture = {
  user: { id: "user_analyticsFixture", createdAt },
  session: { id: "sess_first", createdAt: createdAt + 1_000, expireAt: Date.now() + 3600_000 },
  signedOut: false,
  syncCount: 0,
  events: [] as unknown[][],
};
Object.assign(globalThis, { analyticsAuthFixture: fixture });
process.env.NEXT_PUBLIC_APP_ENV = "development";
process.env.NEXT_PUBLIC_GA4_TEST_MEASUREMENT_ID = "G-STATEMENTXLTEST";

const modules = new Map([
  ["server-only", "export {};"],
  ["@/lib/db/server", "export const getDatabase = () => globalThis.testDatabase;"],
  ["@/lib/auth/server", `export async function getSession() {
    const f = globalThis.analyticsAuthFixture;
    return f.signedOut ? { userId: null, sessionId: null } : { userId: f.user.id, sessionId: f.session.id };
  }`],
  ["@clerk/nextjs/server", `export async function clerkClient() {
    const f = globalThis.analyticsAuthFixture;
    return { users: { getUser: async () => f.user }, sessions: { getSession: async () => f.session } };
  }`],
  ["@/lib/billing/subscriptions", `export async function syncBillingSubscriptionStatus() {
    globalThis.analyticsAuthFixture.syncCount += 1;
  }`],
  ["@next/third-parties/google", `export function sendGAEvent(...event) { globalThis.analyticsAuthFixture.events.push(event); }`],
]);
registerHooks({
  resolve(specifier, context, next) {
    const content = modules.get(specifier);
    return content ? { url: `data:text/javascript,${encodeURIComponent(content)}`, shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    return url.startsWith("data:text/javascript,")
      ? { format: "module", source: decodeURIComponent(url.slice(21)), shortCircuit: true }
      : next(url, context);
  },
});

test("Clerk records one login per verified session and waits for the account summary before tracking the trial", async (t) => {
  await setupD1(t);
  const { GET } = await import("@/app/api/auth/complete/route");
  const { createAccountSummaryLoader } = await import("@/lib/account/summary-loader");
  const { trackTrialStart, trackVerifiedLogin } = await import("@/lib/analytics");
  const { loginPendingCookie, trialPendingCookie } = await import("@/config/analytics");
  const storage = new Map<string, string>();
  const cookies = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() { return [...cookies].map(([name, value]) => `${name}=${value}`).join("; "); },
      set cookie(value: string) {
        assert.match(value, /Max-Age=0/);
        cookies.delete(value.split("=")[0]);
      },
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  });
  const callback = () => GET(new Request("http://localhost:3000/api/auth/complete?locale=fr"));
  const loadCookies = (response: Awaited<ReturnType<typeof callback>>) => {
    for (const { name, value } of response.cookies.getAll()) {cookies.set(name, value);}
  };
  const eventNames = () => fixture.events.map((entry) => entry[1]);
  const fresh = await callback();
  assert.equal(new URL(fresh.headers.get("location")!).pathname, "/fr");
  loadCookies(fresh);
  assert.equal(cookies.get(loginPendingCookie), "sign_up");
  assert.equal(cookies.get(trialPendingCookie), "true");

  let summaryAvailable = false;
  const summaryStates: string[] = [];
  t.mock.method(globalThis, "fetch", async () => summaryAvailable
    ? Response.json({ user: { email: null, avatarUrl: null }, activeTier: null, hasSubscription: false, cancelledPeriodEnd: null })
    : Response.json({}, { status: 503 }));
  const summary = createAccountSummaryLoader((state) => {
    summaryStates.push(state.status);
    if (state.status === "ready" && state.summary.user) {
      trackTrialStart(fixture.user.id, "fr", state.summary.activeTier !== null);
    }
  });
  t.after(() => summary.dispose());
  summary.setUser(fixture.user.id);
  await summary.refresh();
  assert.equal(summaryStates.at(-1), "error");
  trackVerifiedLogin(fixture.user.id, "fr");
  trackVerifiedLogin(fixture.user.id, "fr");
  assert.deepEqual(eventNames(), ["login", "sign_up"]);
  assert.equal(cookies.has(loginPendingCookie), false);
  assert.equal(cookies.has(trialPendingCookie), true);

  summaryAvailable = true;
  await summary.refresh();
  await summary.refresh();
  assert.equal(cookies.has(trialPendingCookie), false);
  assert.deepEqual(eventNames(), ["login", "sign_up", "start_trial"]);

  const repeated = await callback();
  assert.equal(repeated.headers.get("set-cookie"), null);
  assert.equal(fixture.syncCount, 1);

  fixture.session = { ...fixture.session, id: "sess_returning", createdAt: Date.now() };
  const returning = await callback();
  loadCookies(returning);
  assert.equal(cookies.get(loginPendingCookie), "login");
  trackVerifiedLogin(fixture.user.id, "fr");
  trackTrialStart(fixture.user.id, "fr", false);
  assert.deepEqual(eventNames(), ["login", "sign_up", "start_trial", "login"]);

  cookies.set(trialPendingCookie, "true");
  trackTrialStart("paid-fixture", "fr", true);
  assert.equal(cookies.has(trialPendingCookie), false);
  assert.deepEqual(eventNames(), ["login", "sign_up", "start_trial", "login"]);
  assert(fixture.events.every((entry) => JSON.stringify(entry[2]) === '{"locale":"fr","method":"clerk"}'));
  assert.equal(fixture.syncCount, 2);

  fixture.signedOut = true;
  const failed = await callback();
  assert.equal(new URL(failed.headers.get("location")!).pathname, "/fr/auth/error");
  assert.equal(failed.headers.get("set-cookie"), null);
  assert.equal(fixture.syncCount, 2);
});

test("checkout only uses available GA4 browser and session identifiers", async () => {
  const { getCheckoutAttribution } = await import("@/lib/analytics");
  const windowFixture = {
    setTimeout,
    gtag(command: string, id: string, field: string, callback: (value: string) => void) {
      assert.equal(command, "get");
      assert.equal(id, "G-STATEMENTXLTEST");
      callback(field === "client_id" ? "123.456" : "789");
    },
    "ga-disable-G-STATEMENTXLTEST": false,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: windowFixture });
  assert.deepEqual(await getCheckoutAttribution(), { clientId: "123.456", sessionId: 789 });
  windowFixture["ga-disable-G-STATEMENTXLTEST"] = true;
  assert.equal(await getCheckoutAttribution(), undefined);
});

test("an older restored conversion deduplicates exports without a persisted ID", async () => {
  const { trackExportSuccess } = await import("@/lib/analytics");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  });
  fixture.events.length = 0;
  trackExportSuccess({ locale: "en", format: "xlsx" });
  trackExportSuccess({ locale: "en", format: "xlsx" });
  trackExportSuccess({ locale: "en", format: "csv" });
  assert.deepEqual(fixture.events.map((entry) => entry[2]), [
    { locale: "en", format: "xlsx" },
    { locale: "en", format: "csv" },
  ]);
});

test("only a signed Clerk deletion removes that user's D1 rows and prevents stale writes", async (t) => {
  const { db, insertRow, rows } = await setupD1(t);
  const { POST } = await import("@/app/api/auth/webhook/route");
  const { consumeConversionQuota, getQuotaContext } = await import("@/lib/usage/server");
  const { insertActivatedBillingSubscription } = await import("@/lib/billing/server");
  const userId = "user_deletedFixture";
  const email = "deleted@example.invalid";
  const date = new Date().toISOString();
  const actor = { type: "user" as const, key: userId, email };
  const activate = (id: string) => insertActivatedBillingSubscription({
    provider: "waffo", eventId: "eventFixture", eventAt: date, subscriptionId: id, payerId: null,
    subscriberEmail: email, currentPeriodStart: date, currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString(),
    userId, email, tier: "standard", planId: "fixturePlan", amount: "9.90", recurringAmount: "9.90",
    originalAmount: "9.90", discountAmount: "0.00", providerDiscountId: null, currencyCode: "USD",
  });
  await consumeConversionQuota(getQuotaContext(actor, null), 1);
  await insertRow("conversion_parse_records", { user_id: userId, email, parse_method: "llm", status: "success", created_at: date });
  await insertRow("conversion_parse_records", { user_id: "user_otherFixture", parse_method: "llm", status: "success", created_at: date });
  assert.equal(await activate("ORD_before"), "applied");

  const signingKey = Buffer.from("fixture-signing-key-that-is-not-a-secret");
  const secret = `whsec_${signingKey.toString("base64")}`;
  const previous = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = secret;
  t.after(() => {
    if (previous === undefined) {delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;}
    else {process.env.CLERK_WEBHOOK_SIGNING_SECRET = previous;}
  });
  const webhookId = "msg_fixture";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ type: "user.deleted", data: { id: userId } });
  const signature = createHmac("sha256", signingKey).update(`${webhookId}.${timestamp}.${body}`).digest("base64");
  const send = (value: string) => POST(new Request("https://fixture.invalid/api/auth/webhook", {
    method: "POST", body,
    headers: { "svix-id": webhookId, "svix-timestamp": timestamp, "svix-signature": `v1,${value}` },
  }) as Parameters<typeof POST>[0]);

  assert.equal((await send("bad")).status, 400);
  assert.equal((await rows("billing_subscriptions")).length, 1);
  assert.equal((await send(signature)).status, 204);
  assert.equal((await send(signature)).status, 204);
  assert.equal((await rows("billing_subscriptions")).length, 0);
  assert.equal((await rows("conversion_usage")).length, 0);
  assert.deepEqual((await rows("conversion_parse_records")).map((row) => row.user_id), ["user_otherFixture"]);
  assert.equal(await activate("ORD_after"), "ignored");
  await assert.rejects(consumeConversionQuota(getQuotaContext(actor, null), 1));
  assert(await db.prepare("SELECT 1 FROM deleted_accounts WHERE user_id = ?").bind(userId).first());
});
