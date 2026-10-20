import "server-only";

import { WaffoPancake, type PaymentStatus, type SubscriptionOrderStatus } from "@waffo/pancake-ts";
import { BillingError } from "@/lib/billing/errors";
import type { CheckoutAttempt, CheckoutState, CheckoutUser, CreatedCheckout } from "@/lib/billing/provider";
import type { MembershipTier } from "@/lib/billing/types";
import { getWaffoConfig, getWaffoProductId } from "./config";

export type WaffoSubscription = {
  id: string;
  storeId: string;
  testMode: boolean;
  buyerEmail: string;
  merchantProvidedBuyerIdentity: string;
  orderMerchantExternalId: string | null;
  status: `${SubscriptionOrderStatus}`;
  billingPeriod: string | null;
  isInTrial: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  currentPeriodNumber: number | null;
  subscriptionProduct: { id: string } | null;
  priceSnapshot: { currency: string; regularPhase: { subtotal: string; total: string } } | null;
};

export type WaffoPayment = {
  id: string;
  orderId: string;
  orderMerchantExternalId: string | null;
  testMode: boolean;
  status: `${PaymentStatus}`;
  periodNumber: number | null;
  pspAmountDetails: { amount: string; currency: string };
  snapshotAmountDetails: { subtotal: string; total: string; taxAmount: string; currency: string };
  createdAt: string;
};

const subscriptionFields = `
  id storeId testMode buyerEmail merchantProvidedBuyerIdentity orderMerchantExternalId
  status billingPeriod isInTrial currentPeriodStart currentPeriodEnd currentPeriodNumber
  subscriptionProduct { id }
  priceSnapshot { currency regularPhase { subtotal total } }
`;

const paymentFields = `
  id orderId orderMerchantExternalId testMode status periodNumber createdAt
  pspAmountDetails { amount currency }
  snapshotAmountDetails { subtotal total taxAmount currency }
`;

export function requireWaffoConfig() {
  const config = getWaffoConfig();
  if (!config) {
    throw new BillingError("configurationMissing", 503);
  }
  return config;
}

export function createWaffoClient(): WaffoPancake {
  const config = requireWaffoConfig();
  return new WaffoPancake({
    merchantId: config.merchantId,
    privateKey: config.privateKey,
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8_000) }),
  });
}

async function queryWaffo<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const result = await createWaffoClient().graphql.query<T>({ query, variables });
  if (result.errors?.length || !result.data) {
    throw new Error("Waffo GraphQL evidence query failed");
  }
  return result.data;
}

export function isWaffoOrderId(value: unknown): value is string {
  return typeof value === "string" && /^ORD_[A-Za-z0-9]+$/.test(value);
}

export async function getWaffoSubscription(id: string): Promise<WaffoSubscription> {
  const result = await queryWaffo<{ subscriptionOrder: WaffoSubscription | null }>(
    `query($id: String!) { subscriptionOrder(id: $id) { ${subscriptionFields} } }`,
    { id },
  );
  if (!result.subscriptionOrder || result.subscriptionOrder.id !== id) {
    throw new Error("Waffo subscription was not found");
  }
  return result.subscriptionOrder;
}

export async function getWaffoPayment(id: string): Promise<WaffoPayment> {
  const result = await queryWaffo<{ payment: WaffoPayment | null }>(`query($id: String!) { payment(id: $id) { ${paymentFields} } }`, {
    id,
  });
  if (!result.payment || result.payment.id !== id) {
    throw new Error("Waffo payment was not found");
  }
  return result.payment;
}

export async function getWaffoCurrentPayment(remote: WaffoSubscription): Promise<WaffoPayment> {
  const result = await queryWaffo<{ payments: WaffoPayment[] }>(
    `query($storeId: String!, $orderId: String!) {
      payments(storeId: $storeId, filter: { orderId: { eq: $orderId }, status: { eq: "succeeded" } },
        orderBy: [created_at_desc], limit: 1) { ${paymentFields} }
    }`,
    { storeId: requireWaffoConfig().storeId, orderId: remote.id },
  );
  if (!result.payments[0]) {
    throw new Error("Waffo current payment is not confirmed");
  }
  return result.payments[0];
}

export async function createWaffoCheckout(
  tier: MembershipTier,
  user: CheckoutUser,
  returnUrl: string,
  attempt: CheckoutAttempt,
): Promise<CreatedCheckout> {
  const config = requireWaffoConfig();
  const productId = getWaffoProductId(tier)!;
  const checkoutId = `wco_${attempt.id}`;
  const original = new URL(returnUrl);
  const successUrl = new URL(original.pathname + original.search, config.returnBaseUrl);
  successUrl.searchParams.set("provider", "waffo");
  successUrl.searchParams.set("checkout_id", checkoutId);
  const client = createWaffoClient();
  attempt.onDispatch();
  const session = await client.checkout.authenticated.create(
    {
      productId,
      currency: "USD",
      buyerIdentity: user.id,
      buyerEmail: user.email,
      orderMerchantExternalId: checkoutId,
      withTrial: false,
      successUrl: successUrl.href,
      expiresInSeconds: 3_600,
    },
    { idempotencyKey: checkoutId },
  );
  return { provider: "waffo", checkoutId, checkoutUrl: session.checkoutUrl, expiresAt: session.expiresAt };
}

export async function resolveWaffoCheckout(
  checkoutId: string,
  tier: MembershipTier,
  userId: string,
  expiresAt?: string | null,
): Promise<CheckoutState> {
  if (!/^wco_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(checkoutId)) {
    throw new BillingError("invalidRequest", 400);
  }
  const result = await queryWaffo<{ subscriptionOrders: WaffoSubscription[] }>(
    `query($storeId: String!, $reference: String!) {
      subscriptionOrders(storeId: $storeId, filter: { orderMerchantExternalId: { eq: $reference } }, limit: 2) {
        ${subscriptionFields}
      }
    }`,
    { storeId: requireWaffoConfig().storeId, reference: checkoutId },
  );
  if (!result.subscriptionOrders.length) {
    // 会话过期不证明旧订单不可付款；无订单也不能据此释放账户占位。
    return { status: expiresAt && Date.parse(expiresAt) <= Date.now() ? "unknown" : "pending" };
  }
  const [remote] = result.subscriptionOrders;
  if (result.subscriptionOrders.length !== 1 || remote.merchantProvidedBuyerIdentity !== userId) {
    throw new BillingError("subscriptionBelongsToAnotherAccount", 409);
  }
  if (remote.subscriptionProduct?.id !== getWaffoProductId(tier) || remote.orderMerchantExternalId !== checkoutId) {
    throw new BillingError("planMismatch", 409);
  }
  if (remote.currentPeriodStart) {
    return { status: "completed", subscriptionId: remote.id };
  }
  if (["canceled", "closed", "expired"].includes(remote.status)) {
    return { status: expiresAt && Date.parse(expiresAt) <= Date.now() ? "closed" : "unknown" };
  }
  return { status: remote.status === "pending" ? "pending" : "processing" };
}

export async function cancelWaffoSubscription(orderId: string): Promise<void> {
  await createWaffoClient().orders.cancelSubscription({ orderId });
}
