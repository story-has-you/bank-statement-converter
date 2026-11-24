import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "http://localhost:8787");
assert(["localhost", "127.0.0.1"].includes(base.hostname), "Run this check against an anonymous local Worker");

for (const [path, status] of [
  ["/", 200],
  ["/zh-CN", 200],
  ["/zh-CN/sign-in", 200],
  ["/zh-CN/sign-up", 200],
  ["/api/account", 401],
  ["/api/account/summary", 200],
  ["/api/auth/complete?locale=zh-CN", 303],
  ["/pdfjs/pdf.worker.mjs", 200],
  ["/ai/zh-CN/privacy.md", 200],
]) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(response.status, status, path);
  assert.equal(response.headers.get("x-robots-tag"), "noindex", path);
  if (status === 303) {
    assert.equal(new URL(response.headers.get("location")).pathname, "/zh-CN/auth/error");
  }
}

const quota = new URL("/api/convert/quota", base);
const initial = await fetch(quota);
assert.equal(initial.status, 200);
const cookie = initial.headers.get("set-cookie")?.split(";")[0];
assert(cookie, "Anonymous quota should set a cookie");

const deduct = () => fetch(quota, {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ pageCount: 1 }),
});
assert.equal((await deduct()).status, 200, "First deduction with a cookie");
assert.equal((await deduct()).status, 429, "Second deduction with the same cookie");
const after = await fetch(quota, { headers: { cookie } });
assert.equal(after.status, 200);
assert.equal((await after.json()).remainingPages, 0);

console.log("Workers smoke passed: locales, auth routes, noindex, PDF.js, and D1 quota with a returning cookie.");
