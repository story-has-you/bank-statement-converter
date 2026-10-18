import "server-only";

import { subscriptionConfig } from "@/config/plans";
import type { ProviderSubscription } from "@/lib/billing/provider";
import type { SubscriptionStatus } from "@/lib/billing/types";
import { getWaffoTier } from "./config";
import { requireWaffoConfig, type WaffoPayment, type WaffoSubscription } from "./server";

export function normalizeWaffoSubscription(remote: WaffoSubscription): ProviderSubscription {
  const config = requireWaffoConfig();
  const tier = remote.subscriptionProduct && getWaffoTier(remote.subscriptionProduct.id);
  const userId = remote.merchantProvidedBuyerIdentity;
  const statuses: Record<WaffoSubscription["status"], SubscriptionStatus> = {
    pending: "APPROVAL_PENDING",
    active: "ACTIVE",
    canceling: "CANCELLED",
    past_due: "PAYMENT_FAILED",
    canceled: "EXPIRED",
    closed: "EXPIRED",
    expired: "EXPIRED",
  };
  if (
    remote.storeId !== config.storeId ||
    remote.testMode !== (config.environment === "test") ||
    !tier ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    !remote.orderMerchantExternalId?.startsWith("wco_")
  ) {
    throw new Error("Waffo subscription identity mismatch");
  }
  return {
    subscriptionId: remote.id,
    planId: remote.subscriptionProduct!.id,
    userId,
    tier,
    status: statuses[remote.status],
    payerId: null,
    subscriberEmail: remote.buyerEmail,
    periodStart: remote.currentPeriodStart,
    periodEnd: remote.currentPeriodEnd,
  };
}

function usdCents(amount: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
    throw new Error("Waffo USD amount is invalid");
  }
  return Math.round(Number(amount) * 100);
}

/** 以渠道实付和订单锁定的税前价、税额核账，避免把报价快照当作付款证据。 */
export function verifyWaffoPayment(remote: WaffoSubscription, payment: WaffoPayment): { amount: string; paidAt: string } {
  const subscription = normalizeWaffoSubscription(remote);
  const expected = Math.round(subscriptionConfig[subscription.tier].monthlyPrice * 100);
  const snapshot = remote.priceSnapshot;
  const paid = payment.pspAmountDetails;
  const charged = payment.snapshotAmountDetails;
  const start = Date.parse(remote.currentPeriodStart ?? "");
  const end = Date.parse(remote.currentPeriodEnd ?? "");
  if (
    remote.billingPeriod !== "monthly" ||
    remote.isInTrial ||
    !snapshot ||
    snapshot.currency !== "USD" ||
    usdCents(snapshot.regularPhase.subtotal) !== expected ||
    !Number.isInteger(remote.currentPeriodNumber) ||
    remote.currentPeriodNumber! <= 0 ||
    payment.periodNumber !== remote.currentPeriodNumber ||
    payment.orderId !== remote.id ||
    payment.orderMerchantExternalId !== remote.orderMerchantExternalId ||
    payment.testMode !== remote.testMode ||
    payment.status !== "succeeded" ||
    paid.currency !== "USD" ||
    charged.currency !== "USD" ||
    usdCents(charged.subtotal) !== expected ||
    usdCents(charged.total) !== expected + usdCents(charged.taxAmount) ||
    usdCents(snapshot.regularPhase.total) !== usdCents(charged.total) ||
    usdCents(paid.amount) !== usdCents(charged.total) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    !Number.isFinite(Date.parse(payment.createdAt)) ||
    Date.parse(payment.createdAt) > Date.now()
  ) {
    throw new Error("Waffo payment evidence is invalid");
  }
  return { amount: (usdCents(paid.amount) / 100).toFixed(2), paidAt: payment.createdAt };
}
