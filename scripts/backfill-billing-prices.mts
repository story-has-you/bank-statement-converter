import { registerHooks } from "node:module";
import nextEnv from "@next/env";

registerHooks({
  resolve(specifier, context, next) {
    return specifier === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    return url === "data:text/javascript,export{}" ? { format: "module", source: "export{}", shortCircuit: true } : next(url, context);
  },
});
nextEnv.loadEnvConfig(process.cwd());
if (process.argv.slice(2).some((arg) => arg !== "--apply")) throw new Error("Usage: pnpm billing:prices:audit [--apply]");
const { createAdminClient } = await import("../src/lib/supabase/admin");
const { backfillBillingPrices } = await import("../src/lib/billing/price-backfill");
const admin = createAdminClient();
if (!admin) throw new Error("Supabase admin configuration is missing");
try {
  const report = await backfillBillingPrices(admin, process.argv.includes("--apply"));
  console.log(JSON.stringify(report, null, 2));
  if (report.blockers.length) process.exitCode = 1;
} catch {
  console.error("Billing price audit failed; keep purchasing paused. No provider response or credential is logged.");
  process.exitCode = 1;
}
