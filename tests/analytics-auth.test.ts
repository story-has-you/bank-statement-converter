import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const fixture = {
  user: { id: "account-fixture", created_at: "2026-11-24T00:00:00Z", last_sign_in_at: "2026-11-24T00:00:04Z" },
  exchangeFailed: false,
  syncCount: 0,
  events: [] as unknown[][],
};
Object.assign(globalThis, { analyticsAuthFixture: fixture });
process.env.NEXT_PUBLIC_VERCEL_ENV = "development";
process.env.NEXT_PUBLIC_GA4_TEST_MEASUREMENT_ID = "G-STATEMENTXLTEST";

const modules = new Map([
  ["@/lib/supabase/server", `export async function createClient() {
    const fixture = globalThis.analyticsAuthFixture;
    return { auth: {
      async exchangeCodeForSession() { return { error: fixture.exchangeFailed }; },
      async getUser() { return { data: { user: fixture.user }, error: null }; },
    } };
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

test("verified Google login and sign-up are recorded while the trial waits for the account summary", async (t) => {
  const { GET } = await import("@/app/api/auth/callback/route");
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
  const callback = () => GET(new Request("http://localhost:3000/api/auth/callback?locale=fr&code=fixture"));
  const loadCookies = (response: Awaited<ReturnType<typeof callback>>) => {
    for (const { name, value } of response.cookies.getAll()) cookies.set(name, value);
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

  const returningTime = "2026-11-24T00:02:00Z";
  fixture.user.last_sign_in_at = returningTime;
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
  assert(fixture.events.every((entry) => JSON.stringify(entry[2]) === '{"locale":"fr","method":"google"}'));
  assert.equal(fixture.syncCount, 2);

  fixture.exchangeFailed = true;
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
