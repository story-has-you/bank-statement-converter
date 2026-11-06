import "server-only";

import { requireRecurringAmount, usdFromDecimal, usdFromMinorUnits, usdToDecimal } from "@/lib/billing/usd";
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
    !/^wco_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(remote.orderMerchantExternalId ?? "") ||
    !Object.hasOwn(statuses, remote.status)
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

/** 以渠道实付和订单锁定的税前价、税额核账，避免把报价快照当作付款证据。 */
export function verifyWaffoPayment(remote: WaffoSubscription, payment: WaffoPayment, recurringAmount: string): {
  amount: string; paidAt: string; originalAmount: string; discountAmount: string; providerDiscountId: string | null;
} {
  normalizeWaffoSubscription(remote);
  const expected = usdFromDecimal(requireRecurringAmount(recurringAmount));
  const snapshot = remote.priceSnapshot;
  const paid = payment.pspAmountDetails;
  const charged = payment.snapshotAmountDetails;
  const original = usdFromDecimal(charged.listTotal);
  const discount = usdFromDecimal(charged.discountAmount);
  const total = usdFromDecimal(charged.total);
  const tax = usdFromDecimal(charged.taxAmount);
  const start = Date.parse(remote.currentPeriodStart ?? "");
  const end = Date.parse(remote.currentPeriodEnd ?? "");
  if (
    remote.billingPeriod !== "monthly" ||
    remote.isInTrial ||
    !snapshot ||
    snapshot.currency !== "USD" ||
    usdFromDecimal(snapshot.regularPhase.subtotal) !== expected ||
    !Number.isInteger(remote.currentPeriodNumber) ||
    remote.currentPeriodNumber! <= 0 ||
    payment.periodNumber !== remote.currentPeriodNumber ||
    payment.orderId !== remote.id ||
    payment.orderMerchantExternalId !== remote.orderMerchantExternalId ||
    payment.testMode !== remote.testMode ||
    payment.status !== "succeeded" ||
    paid.currency !== "USD" ||
    charged.currency !== "USD" ||
    usdFromDecimal(charged.subtotal) !== expected ||
    original !== usdFromMinorUnits(expected + usdFromDecimal(snapshot.regularPhase.taxAmount)) ||
    usdFromDecimal(snapshot.regularPhase.total) !== original ||
    discount > original ||
    total !== original - discount ||
    tax > total ||
    tax > usdFromDecimal(snapshot.regularPhase.taxAmount) ||
    usdFromDecimal(snapshot.regularPhase.taxAmount) - tax > discount ||
    (discount > 0 && !remote.discount?.couponId?.trim()) ||
    usdFromDecimal(paid.amount) !== total ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    !Number.isFinite(Date.parse(payment.createdAt)) ||
    Date.parse(payment.createdAt) > Date.now()
  ) {
    throw new Error("Waffo payment evidence is invalid");
  }
  return {
    amount: usdToDecimal(total), paidAt: payment.createdAt,
    originalAmount: usdToDecimal(original), discountAmount: usdToDecimal(discount),
    providerDiscountId: discount > 0 ? remote.discount!.couponId : null,
  };
}

export function getWaffoAgreedAmount(remote: WaffoSubscription): string {
  if (remote.billingPeriod !== "monthly" || remote.isInTrial || remote.priceSnapshot?.currency !== "USD") {
    throw new Error("Waffo subscription price evidence is invalid");
  }
  return requireRecurringAmount(remote.priceSnapshot.regularPhase.subtotal);
}
