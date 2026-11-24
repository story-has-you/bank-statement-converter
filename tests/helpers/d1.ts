import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import type { TestContext } from "node:test";
import type { BillingSubscription } from "@/lib/billing/server";

declare global {
  var testDatabase: D1Database;
}

const migration = readFile(new URL("../../d1/migrations/0001_initial.sql", import.meta.url), "utf8");

export async function setupD1(t: TestContext, subscriptions: BillingSubscription[] = []) {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response(null); } };",
      d1Databases: { DB: "statementxl-test" },
    }),
  );
  t.after(() => miniflare.dispose());
  const db = await miniflare.getD1Database("DB");
  globalThis.testDatabase = db;
  await db.batch(
    (await migration)
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => db.prepare(statement)),
  );
  for (const row of subscriptions) {
    const { amount, recurring_amount_usd, original_amount, discount_amount, ...fields } = row;
    await insertRow("billing_subscriptions", {
      ...fields,
      last_webhook_event_id: fields.last_webhook_event_id ?? "fixture-first",
      last_event_at: fields.last_event_at ?? fields.created_at,
      updated_at: fields.created_at,
      amount_cents: Math.round(amount! * 100),
      recurring_amount_cents: Math.round(recurring_amount_usd! * 100),
      original_amount_cents: Math.round(original_amount! * 100),
      discount_amount_cents: Math.round(discount_amount! * 100),
    });
  }

  async function insertRow(table: string, row: Record<string, unknown>) {
    const columns = Object.keys(row);
    await db
      .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
      .bind(...Object.values(row))
      .run();
  }

  async function rows<T = Record<string, unknown>>(table: string) {
    const query =
      table === "billing_subscriptions"
        ? `SELECT *, amount_cents / 100.0 AS amount, recurring_amount_cents / 100.0 AS recurring_amount_usd,
           original_amount_cents / 100.0 AS original_amount, discount_amount_cents / 100.0 AS discount_amount
         FROM billing_subscriptions ORDER BY rowid`
        : `SELECT * FROM ${table}`;
    return (await db.prepare(query).all<T>()).results;
  }

  return { db, insertRow, rows };
}
