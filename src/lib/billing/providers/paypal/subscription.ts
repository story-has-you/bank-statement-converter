import "server-only";

import type { ProviderSubscription } from "@/lib/billing/provider";
import { subscriptionStatuses } from "@/lib/billing/types";
import { getPayPalTier } from "./config";
import type { PayPalSubscription } from "./server";

/** Calculate every boundary from the original day, so February does not shift March. */
function monthlyBoundary(anchor: Date, months: number): Date {
  const result = new Date(anchor);
  result.setUTCDate(1);
  result.setUTCMonth(anchor.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return result;
}

export function getPayPalPaidPeriod(remote: PayPalSubscription, paidAt: string): { periodStart: string; periodEnd: string } {
  const anchor = new Date(remote.start_time);
  const payment = new Date(paidAt);
  if (!Number.isFinite(anchor.valueOf()) || !Number.isFinite(payment.valueOf()) || payment < anchor) {
    throw new Error("PayPal paid billing period is invalid");
  }
  let months = (payment.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + payment.getUTCMonth() - anchor.getUTCMonth();
  if (monthlyBoundary(anchor, months) > payment) {
    months -= 1;
  }
  const start = monthlyBoundary(anchor, months);
  const end = monthlyBoundary(anchor, months + 1);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

export function normalizePayPalSubscription(remote: PayPalSubscription): ProviderSubscription {
  const tier = getPayPalTier(remote.plan_id);
  if (
    !tier ||
    !subscriptionStatuses.includes(remote.status) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(remote.custom_id)
  ) {
    throw new Error("PayPal subscription identity is incomplete");
  }
  const payment = remote.billing_info?.last_payment;
  const period = payment ? getPayPalPaidPeriod(remote, payment.time) : { periodStart: null, periodEnd: null };
  return {
    subscriptionId: remote.id,
    planId: remote.plan_id,
    userId: remote.custom_id,
    tier,
    status: remote.status === "ACTIVE" && remote.billing_info!.failed_payments_count > 0 ? "PAYMENT_FAILED" : remote.status,
    payerId: remote.subscriber?.payer_id ?? null,
    subscriberEmail: remote.subscriber?.email_address ?? null,
    ...period,
  };
}
