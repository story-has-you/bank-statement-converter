import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { setImmediate } from "node:timers/promises";

import { anonymousAccountSummary, type PublicAccountSummary } from "@/lib/account/summary";
import { createAccountSummaryLoader, type PublicAccountState } from "@/lib/account/summary-loader";

const free: PublicAccountSummary = {
  ...anonymousAccountSummary,
  user: { email: "account-a@example.com", avatarUrl: null },
};
const paid: PublicAccountSummary = { ...free, activeTier: "professional", hasSubscription: true };

function setup(t: TestContext) {
  const states: PublicAccountState[] = [];
  const requests: { signal: AbortSignal; resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
  t.mock.method(globalThis, "fetch", (url: string, options: RequestInit) => {
    assert.equal(url, "/api/account/summary");
    assert.equal(options.cache, "no-store");
    return new Promise<Response>((resolve, reject) => requests.push({ signal: options.signal!, resolve, reject }));
  });
  const loader = createAccountSummaryLoader((state) => states.push(state));
  t.after(() => loader.dispose());
  return { loader, requests, states, latest: () => states.at(-1) };
}

test("payment confirmation refreshes an initially free account without another auth event", async (t) => {
  const { loader, requests, latest } = setup(t);
  loader.setUser("account-a");
  await setImmediate();
  requests[0].resolve(Response.json(free));
  await setImmediate();
  assert.deepEqual(latest(), { status: "ready", summary: free });

  const refreshed = loader.refresh();
  assert.equal(latest()?.status, "loading");
  await setImmediate();
  requests[1].resolve(Response.json(paid));
  await refreshed;
  assert.deepEqual(latest(), { status: "ready", summary: paid });
  assert.equal(requests.length, 2);
});

test("confirmation supersedes an unfinished initial read even if the old response arrives last", async (t) => {
  const { loader, requests, latest, states } = setup(t);
  loader.setUser("account-a");
  await setImmediate();
  const refreshed = loader.refresh();
  await setImmediate();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(Response.json(paid));
  await refreshed;
  const updates = states.length;
  // Simulate a transport that still delivers a result after cancellation.
  requests[0].resolve(Response.json(free));
  await setImmediate();
  assert.equal(states.length, updates);
  assert.deepEqual(latest(), { status: "ready", summary: paid });
});

test("concurrent invalidations share one scheduled refresh instead of duplicating requests", async (t) => {
  const { loader, requests, latest } = setup(t);
  loader.setUser("account-a");
  const first = loader.refresh();
  const second = loader.refresh();
  assert.equal(first, second);
  await setImmediate();
  assert.equal(requests.length, 1);
  requests[0].resolve(Response.json(paid));
  await Promise.all([first, second]);
  assert.deepEqual(latest(), { status: "ready", summary: paid });
});

test("a second subscription mutation invalidates a refresh already in flight", async (t) => {
  const { loader, requests, latest } = setup(t);
  loader.setUser("account-a");
  await setImmediate();
  requests[0].resolve(Response.json(free));
  await setImmediate();
  const firstMutation = loader.refresh();
  await setImmediate();
  const refreshed = loader.refresh();
  await setImmediate();
  requests[1].reject(new Error("Old request failed after cancellation"));
  requests[2].resolve(Response.json({ ...paid, cancelledPeriodEnd: "2099-01-01T00:00:00Z" }));
  await Promise.all([firstMutation, refreshed]);
  assert.equal(latest()?.summary.activeTier, "professional");
  assert.equal(latest()?.summary.hasSubscription, true);
  assert.equal(latest()?.summary.cancelledPeriodEnd, "2099-01-01T00:00:00Z");
  assert.equal(latest()?.status, "ready");
});

test("switching accounts clears the previous identity immediately and ignores its late response", async (t) => {
  const { loader, requests, latest, states } = setup(t);
  loader.setUser("account-a");
  await setImmediate();
  requests[0].resolve(Response.json(paid));
  await setImmediate();
  void loader.refresh();
  await setImmediate();

  loader.setUser("account-b");
  assert.deepEqual(latest(), { status: "loading", summary: anonymousAccountSummary });
  await setImmediate();
  const accountB = { ...free, user: { email: "account-b@example.com", avatarUrl: null } };
  requests[2].resolve(Response.json(accountB));
  await setImmediate();
  const updates = states.length;
  requests[1].resolve(Response.json(paid));
  await setImmediate();
  assert.equal(states.length, updates);
  assert.deepEqual(latest(), { status: "ready", summary: accountB });
});

test("signing out cancels the read and keeps the anonymous state when it finishes late", async (t) => {
  const { loader, requests, latest, states } = setup(t);
  loader.setUser("account-a");
  await setImmediate();
  loader.setUser(null);
  const updates = states.length;
  assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve(Response.json(paid));
  await setImmediate();
  await loader.refresh();
  assert.equal(requests.length, 1);
  assert.equal(states.length, updates);
  assert.deepEqual(latest(), { status: "ready", summary: anonymousAccountSummary });
});

test("signing out before a queued read prevents the request entirely", async (t) => {
  const { loader, requests, latest } = setup(t);
  loader.setUser("account-a");
  loader.setUser(null);
  await setImmediate();
  assert.equal(requests.length, 0);
  assert.deepEqual(latest(), { status: "ready", summary: anonymousAccountSummary });
});

test("a failed refresh reports an error and allows an explicit retry without background polling", async (t) => {
  const { loader, requests, latest } = setup(t);
  loader.setUser("account-a");
  await setImmediate();
  requests[0].resolve(Response.json(free));
  await setImmediate();
  const failed = loader.refresh();
  await setImmediate();
  requests[1].resolve(Response.json({ code: "ACCOUNT_SUMMARY_UNAVAILABLE" }, { status: 503 }));
  await failed;
  assert.equal(latest()?.status, "error");
  await setImmediate();
  assert.equal(requests.length, 2);

  const retried = loader.refresh();
  await setImmediate();
  requests[2].resolve(Response.json(paid));
  await retried;
  assert.deepEqual(latest(), { status: "ready", summary: paid });
});

test("unmounting cancels pending work and prevents requests or state updates after disposal", async (t) => {
  const { loader, requests, states } = setup(t);
  loader.setUser("account-a");
  await setImmediate();
  loader.dispose();
  const updates = states.length;
  assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve(Response.json(paid));
  await setImmediate();
  loader.setUser("account-b");
  await loader.refresh();
  assert.equal(states.length, updates);
  assert.equal(requests.length, 1);
});

test("unmounting before a scheduled refresh prevents the request", async (t) => {
  const { loader, requests, states } = setup(t);
  loader.setUser("account-a");
  loader.dispose();
  const updates = states.length;
  await setImmediate();
  assert.equal(states.length, updates);
  assert.equal(requests.length, 0);
});
