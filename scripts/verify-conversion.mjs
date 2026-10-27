import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { PDFDocument, StandardFonts } from "pdf-lib";

const state = { entitled: false, used: 0, outcome: "ok", aiCalls: 0, background: [] };
const context = {
  type: "user",
  key: "integration-user",
  email: null,
  limitPages: 50,
  subscriptionId: "synthetic",
  window: { period: "month", start: new Date("2026-10-01"), end: new Date("2026-11-01") },
};
globalThis.conversionCheck = {
  state,
  context,
  async getQuota() {
    return {
      context,
      subscription: state.entitled ? { tier: "professional" } : null,
      quota: { remainingPages: 50 - state.used },
      usedPages: state.used,
      anonymousCookie: null,
    };
  },
  async consume(_context, pages) {
    await new Promise((resolve) => setImmediate(resolve));
    if (state.outcome === "write-failure") {
      throw new Error("synthetic failure");
    }
    const stale = state.outcome === "stale";
    const allowed = !stale && state.used + pages <= 50;
    if (allowed) {
      state.used += pages;
    }
    return {
      allowed,
      status: stale ? "stale" : allowed ? "consumed" : "exceeded",
      period: "month",
      usedPages: state.used,
      remainingPages: 50 - state.used,
      limitPages: 50,
    };
  },
};
const sources = {
  "server-only": "",
  "next/server": `export class NextResponse extends Response {static json(value,init){return new NextResponse(JSON.stringify(value),{...init,headers:{"Content-Type":"application/json",...init?.headers}});}} export function after(callback){globalThis.conversionCheck.state.background.push(callback);}`,
  "@/lib/usage/server": `export class UsageUnavailableError extends Error{} export class SubscriptionPeriodUnavailableError extends Error{} export async function consumeConversionQuota(...args){return globalThis.conversionCheck.consume(...args);}`,
  "@/lib/usage/request": `export async function getRequestQuota(){return globalThis.conversionCheck.getQuota();} export async function setAnonymousCookie(response){return response;}`,
  "@/i18n/locale": `export function getRequestLocale(){return "en";}`,
  "next-intl/server": `export async function getTranslations(){const t=key=>key;t.has=()=>true;return t;}`,
  "@/lib/qwen/parser": `export async function parseWithQwen(){globalThis.conversionCheck.state.aiCalls++;return {schemaVersion:"1",filename:"synthetic.pdf",pageCount:1,tables:[],summary:{status:"success",tableCount:0,rowCount:0,validRowCount:1,warningRowCount:0,failedRowCount:0},errors:[]};}`,
  "./records": `export function createParseRecord(){return null;} export function scheduleParseRecord(){} export function getParseErrorCode(){return "UNKNOWN";}`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(sources, specifier)) {
      return { url: `data:text/javascript,${encodeURIComponent(sources[specifier])}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("data:text/javascript,")) {
      return { format: "module", source: decodeURIComponent(url.slice(21)), shortCircuit: true };
    }
    return next(url, context);
  },
});
const quota = await import("../src/app/api/convert/quota/route.ts");
const ai = await import("../src/app/api/convert/route.ts");
function request(pages) {
  return new Request("http://local/api/convert/quota", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageCount: pages }),
  });
}
assert.equal((await quota.POST(request(3))).status, 200);
assert.equal(state.used, 3);
for (const value of [0, -1, 1.2, "2", null]) {
  assert.equal((await quota.POST(request(value))).status, 400);
}
state.outcome = "write-failure";
assert.equal((await (await quota.POST(request(1))).json()).code, "QUOTA_RECORD_FAILED");
assert.equal(state.used, 3);
state.outcome = "stale";
assert.equal((await (await quota.POST(request(1))).json()).code, "QUOTA_PERIOD_UNAVAILABLE");
assert.equal(state.used, 3);
state.outcome = "ok";
state.used = 49;
const outcomes = await Promise.all([quota.POST(request(1)), quota.POST(request(1))]);
assert.deepEqual(outcomes.map((result) => result.status).sort(), [200, 429]);
assert.equal(state.used, 50);
assert.equal(state.aiCalls, 0);
const document = await PDFDocument.create();
document.addPage().drawText("Synthetic statement", { font: await document.embedFont(StandardFonts.Helvetica) });
const bytes = await document.save();
function aiRequest(method = "llm", sse = false) {
  const body = new FormData();
  body.append("method", method);
  body.append("file", new File([bytes], "synthetic.pdf", { type: "application/pdf" }));
  return new Request("http://local/api/convert", { method: "POST", body, headers: sse ? { Accept: "text/event-stream" } : {} });
}
state.used = 0;
assert.equal((await ai.POST(aiRequest("code"))).status, 400);
assert.equal((await ai.POST(aiRequest())).status, 403);
assert.equal(state.aiCalls, 0);
state.entitled = true;
assert.equal((await ai.POST(aiRequest())).status, 200);
const stream = await ai.POST(aiRequest("llm", true));
const text = await stream.text();
assert(text.includes("event: complete"));
assert.equal(state.aiCalls, 2);
state.entitled = false;
assert.equal((await ai.POST(aiRequest())).status, 403);
assert.equal(state.aiCalls, 2);
console.log(
  "Conversion route integration passed: quota success, invalid input, failed write, stale period, concurrent exhaustion; explicit AI, entitlement, JSON/SSE. No external services called.",
);
