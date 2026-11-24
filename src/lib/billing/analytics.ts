import "server-only";

import { analyticsMeasurementId, analyticsTestMode } from "@/config/analytics";
import { readCheckoutAttribution, type CheckoutAttribution } from "@/lib/analytics-attribution";
import { getDatabase } from "@/lib/db/server";
import type { AppLocale } from "@/i18n/routing";
import type { BillingEvent } from "./provider";
import { usdFromDecimal } from "./usd";

const retentionMs = 72 * 60 * 60 * 1_000;
type PaidEvent = Extract<BillingEvent, { type: "subscription-paid" }>;

function measurementConfig(testMode: boolean) {
  const apiSecret = process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET?.trim();
  if (analyticsMeasurementId && apiSecret && testMode === analyticsTestMode) {
    return { measurementId: analyticsMeasurementId, apiSecret };
  }
}

export async function saveCheckoutAttribution(
  checkoutId: string,
  locale: AppLocale,
  attribution: CheckoutAttribution | undefined,
  testMode: boolean,
): Promise<void> {
  if (!measurementConfig(testMode)) {
    return;
  }
  try {
    const db = getDatabase();
    const now = new Date();
    const cleanup = db.prepare("DELETE FROM billing_checkout_analytics WHERE created_at < ?")
      .bind(new Date(now.valueOf() - retentionMs).toISOString()).run()
      .catch(() => console.warn("GA4_CHECKOUT_ATTRIBUTION_CLEANUP_FAILED"));
    const insert = attribution && db.prepare(`INSERT INTO billing_checkout_analytics
      (checkout_id, client_id, session_id, locale, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(checkoutId, attribution.clientId, attribution.sessionId, locale, now.toISOString()).run();
    await Promise.all([cleanup, insert]);
  } catch {
    console.warn("GA4_CHECKOUT_ATTRIBUTION_WRITE_FAILED");
  }
}

export async function reportFirstPurchase(event: PaidEvent): Promise<void> {
  const { payment, provider, subscription, currencyCode, amount, paidAt } = event;
  const config = measurementConfig(payment.testMode);
  if (!config) {
    return;
  }
  try {
    const db = getDatabase();
    const cutoff = Date.now() - retentionMs;
    const paidTime = Date.parse(paidAt);
    if (!Number.isFinite(paidTime) || paidTime < cutoff) {
      return;
    }
    const data = await db.prepare(`SELECT client_id, session_id, locale FROM billing_checkout_analytics
      WHERE checkout_id = ? AND created_at >= ?`)
      .bind(payment.checkoutId, new Date(cutoff).toISOString())
      .first<{ client_id: string; session_id: number; locale: string }>();
    const attribution = data && readCheckoutAttribution({ clientId: data.client_id, sessionId: data.session_id });
    if (!data || !attribution) {
      return;
    }
    const tax = usdFromDecimal(payment.taxAmount);
    const value = (usdFromDecimal(amount) - tax) / 100;
    const url = new URL("https://www.google-analytics.com/mp/collect");
    url.searchParams.set("measurement_id", config.measurementId);
    url.searchParams.set("api_secret", config.apiSecret);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3_000),
      body: JSON.stringify({
        client_id: attribution.clientId,
        timestamp_micros: paidTime * 1_000,
        events: [{
          name: "purchase",
          params: {
            session_id: attribution.sessionId,
            // DebugView only shows test events with a positive engagement time.
            ...(payment.testMode ? { debug_mode: true, engagement_time_msec: 1 } : {}),
            transaction_id: `${provider}:${payment.id}`,
            currency: currencyCode,
            value,
            tax: tax / 100,
            locale: data.locale,
            plan_tier: subscription.tier,
            payment_provider: provider,
            items: [{ item_id: subscription.tier, price: value, quantity: 1 }],
          },
        }],
      }),
    });
    if (!response.ok) {
      console.warn("GA4_PURCHASE_DELIVERY_FAILED");
      return;
    }
    await db.prepare("DELETE FROM billing_checkout_analytics WHERE checkout_id = ?")
      .bind(payment.checkoutId).run();
  } catch {
    console.warn("GA4_PURCHASE_DELIVERY_FAILED");
  }
}
