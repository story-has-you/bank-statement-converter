import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(await readFile(resolve(root, "src/config/indexnow.json"), "utf8"));
const args = process.argv.slice(2);
const allowed = new Set(["--submit", "--sitemap", "--url", "--help"]);
let submit = false;
let sitemap = resolve(root, ".next/server/app/sitemap.xml.body");
const requested = [];
for (let i = 0; i < args.length; i++) {
  const option = args[i];
  if (!allowed.has(option)) {
    throw new Error(`Unknown option: ${option}`);
  }
  if (option === "--help") {
    console.log(
      "node scripts/seo/indexnow.mjs [--sitemap FILE] [--url CANONICAL_URL]... [--submit]\nDefault: preview published HTML URLs from the local production sitemap. --submit verifies the public key file before notifying IndexNow.",
    );
    process.exit(0);
  }
  if (option === "--submit") {
    submit = true;
  } else {
    const value = args[++i];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`);
    }
    if (option === "--sitemap") {
      sitemap = resolve(value);
    }
    if (option === "--url") {
      requested.push(value);
    }
  }
}
const xml = await readFile(sitemap, "utf8");
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replaceAll("&amp;", "&"));
const canonical = locations.filter((location) => {
  const url = new URL(location);
  if (url.protocol !== "https:" || url.host !== config.host || url.search || url.hash) {
    throw new Error("Use a production sitemap containing only canonical URLs on the configured host.");
  }
  return !url.pathname.includes(".") && !/^\/(api|account|auth|result|billing)(\/|$)/.test(url.pathname);
});
if (!canonical.length) {
  throw new Error("No public HTML URLs found in sitemap.");
}
const urls = [...new Set(requested.length ? requested : canonical)];
for (const url of urls) {
  if (!canonical.includes(url)) {
    throw new Error("Requested URL is not a public canonical HTML URL in the sitemap.");
  }
}
if (urls.length > 10000) {
  throw new Error("IndexNow accepts at most 10,000 URLs per request.");
}
console.log(
  JSON.stringify({ mode: submit ? "submit" : "preview", host: config.host, urls: urls.length, first: urls[0], last: urls.at(-1) }, null, 2),
);
if (submit) {
  const keyLocation = `https://${config.host}/${config.key}.txt`;
  const keyResponse = await fetch(keyLocation, { signal: AbortSignal.timeout(15000) });
  if (!keyResponse.ok || (await keyResponse.text()).trim() !== config.key) {
    throw new Error("Public key file is not deployed or does not match. No submission sent.");
  }
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ host: config.host, key: config.key, keyLocation, urlList: urls }),
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow rejected the notification: HTTP ${response.status}`);
  }
  console.log(`Notification accepted (HTTP ${response.status}); indexing is not guaranteed.`);
}
