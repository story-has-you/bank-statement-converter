import "server-only";

import { analyticsMeasurementId, analyticsTestMode } from "@/config/analytics";
import { readCheckoutAttribution, type CheckoutAttribution } from "@/lib/analytics-attribution";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppLocale } from "@/i18n/routing";
import type { BillingEvent } from "./provider";
import { usdFromDecimal } from "./usd";

const retentionMs = 72 * 60 * 60 * 1_000;
const table = "billing_checkout_analytics";
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
  if (!measurementConfig(testMode)) return;
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const cutoff = new Date(Date.now() - retentionMs).toISOString();
    const cleanup = admin.from(table).delete().lt("created_at", cutoff).abortSignal(AbortSignal.timeout(1_000));
    const insert = attribution && admin.from(table).insert({
      checkout_id: checkoutId, client_id: attribution.clientId, session_id: attribution.sessionId, locale,
    }).abortSignal(AbortSignal.timeout(1_000));
    const [deleted, inserted] = await Promise.all([cleanup, insert]);
    if (deleted.error) console.warn("GA4_CHECKOUT_ATTRIBUTION_CLEANUP_FAILED");
    if (inserted?.error) console.warn("GA4_CHECKOUT_ATTRIBUTION_WRITE_FAILED");
  } catch {
    console.warn("GA4_CHECKOUT_ATTRIBUTION_WRITE_FAILED");
  }
}

export async function reportFirstPurchase(event: PaidEvent): Promise<void> {
  const { payment, provider, subscription, currencyCode, amount, paidAt } = event;
  const config = measurementConfig(payment.testMode);
  if (!config) return;
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const cutoff = Date.now() - retentionMs;
    const paidTime = Date.parse(paidAt);
    if (!Number.isFinite(paidTime) || paidTime < cutoff) return;
    const { data, error } = await admin.from(table).select("client_id, session_id, locale")
      .eq("checkout_id", payment.checkoutId).gte("created_at", new Date(cutoff).toISOString())
      .abortSignal(AbortSignal.timeout(1_000)).maybeSingle();
    if (error) {
      console.warn("GA4_CHECKOUT_ATTRIBUTION_READ_FAILED");
      return;
    }
    const attribution = data && readCheckoutAttribution({ clientId: data.client_id, sessionId: data.session_id });
    if (!data || !attribution) return;
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
    const removed = await admin.from(table).delete().eq("checkout_id", payment.checkoutId).abortSignal(AbortSignal.timeout(1_000));
    if (removed.error) console.warn("GA4_CHECKOUT_ATTRIBUTION_CLEANUP_FAILED");
  } catch {
    console.warn("GA4_PURCHASE_DELIVERY_FAILED");
  }
}
