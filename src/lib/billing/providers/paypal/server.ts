import "server-only";

import { subscriptionConfig } from "@/config/plans";
import { usdFromDecimal, type UsdCents } from "@/lib/billing/usd";
import { BillingError } from "@/lib/billing/errors";
import type { CheckoutAttempt, CheckoutState, CheckoutUser, CreatedCheckout } from "@/lib/billing/provider";
import type { MembershipTier, SubscriptionStatus } from "@/lib/billing/types";
import { getPayPalConfig, getPayPalEnvironment, getPayPalPlanId } from "./config";

type Money = { value: string; currency_code: string };
type BillingCycle = {
  tenure_type: string;
  total_cycles: number;
  frequency: { interval_unit: string; interval_count: number };
  pricing_scheme: { fixed_price: Money };
};
type PayPalPlan = {
  id: string;
  status: string;
  billing_cycles: BillingCycle[];
  payment_preferences: { setup_fee?: Money };
  taxes?: { percentage: string };
};

export type PayPalSubscription = {
  id: string;
  plan_id: string;
  custom_id: string;
  status: Exclude<SubscriptionStatus, "PAYMENT_FAILED">;
  start_time: string;
  subscriber?: { payer_id?: string; email_address?: string };
  billing_info?: {
    next_billing_time?: string;
    failed_payments_count: number;
    last_payment?: { amount: Money; time: string };
  };
};

export type PayPalTransaction = {
  id: string;
  status: string;
  time: string;
  amount_with_breakdown: { gross_amount: Money };
};

/** Keep credentials and provider responses on the server; report no raw response bodies. */
export async function requestPayPal<T>(path: string, init: RequestInit = {}, onDispatch?: () => void): Promise<T> {
  const config = getPayPalConfig();
  if (!config) {
    throw new BillingError("configurationMissing", 503);
  }
  const tokenResponse = await fetch(`${config.apiUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) {
    throw new Error(`PayPal authentication failed (${tokenResponse.status})`);
  }
  const token = (await tokenResponse.json()) as { access_token: string };
  onDispatch?.();
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`PayPal API request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function isPayPalSubscriptionId(value: unknown): value is string {
  return typeof value === "string" && /^I-[A-Z0-9]{1,64}$/.test(value);
}

export async function getPayPalPlan(tier: MembershipTier): Promise<PayPalPlan> {
  const planId = getPayPalPlanId(tier);
  if (!planId) {
    throw new BillingError("configurationMissing", 503);
  }
  const plan = await requestPayPal<PayPalPlan>(`/v1/billing/plans/${encodeURIComponent(planId)}`);
  const cycle = plan.billing_cycles[0];
  let priceCents: UsdCents;
  let setupFeeCents: UsdCents;
  try {
    priceCents = usdFromDecimal(cycle.pricing_scheme.fixed_price.value);
    setupFeeCents = usdFromDecimal(plan.payment_preferences.setup_fee?.value ?? "0");
  } catch {
    throw new BillingError("configurationMissing", 503);
  }
  if (
    plan.id !== planId ||
    plan.status !== "ACTIVE" ||
    plan.billing_cycles.length !== 1 ||
    cycle.tenure_type !== "REGULAR" ||
    cycle.total_cycles !== 0 ||
    cycle.frequency.interval_unit !== "MONTH" ||
    cycle.frequency.interval_count !== 1 ||
    cycle.pricing_scheme.fixed_price.currency_code !== "USD" ||
    priceCents !== usdFromDecimal(String(subscriptionConfig[tier].monthlyPrice)) ||
    setupFeeCents !== 0 ||
    Number(plan.taxes?.percentage ?? 0) !== 0
  ) {
    throw new BillingError("configurationMissing", 503);
  }
  return plan;
}

export async function createPayPalCheckout(
  tier: MembershipTier,
  user: CheckoutUser,
  returnUrl: string,
  attempt: CheckoutAttempt,
): Promise<CreatedCheckout> {
  const plan = await getPayPalPlan(tier);
  const successUrl = new URL(returnUrl);
  successUrl.searchParams.set("provider", "paypal");
  const cancelUrl = new URL(successUrl);
  cancelUrl.searchParams.set("cancelled", "true");
  const subscription = await requestPayPal<{ id: string; links: { rel: string; href: string }[] }>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      headers: { "PayPal-Request-Id": attempt.id },
      body: JSON.stringify({
        plan_id: plan.id,
        custom_id: user.id,
        application_context: {
          brand_name: "StatementXL",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: successUrl.href,
          cancel_url: cancelUrl.href,
        },
      }),
    },
    attempt.onDispatch,
  );
  const approve = subscription.links.find((link) => link.rel === "approve");
  if (!isPayPalSubscriptionId(subscription.id) || !approve) {
    throw new Error("PayPal checkout response is incomplete");
  }
  const url = new URL(approve.href);
  const host = getPayPalEnvironment() === "sandbox" ? "www.sandbox.paypal.com" : "www.paypal.com";
  if (url.protocol !== "https:" || url.hostname !== host) {
    throw new Error("PayPal approval URL is invalid");
  }
  return { provider: "paypal", checkoutId: subscription.id, checkoutUrl: url.href, expiresAt: null };
}

export async function getPayPalSubscription(id: string): Promise<PayPalSubscription> {
  const subscription = await requestPayPal<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
  if (subscription.id !== id) {
    throw new Error("PayPal subscription ID mismatch");
  }
  return subscription;
}

export async function resolvePayPalCheckout(id: string, tier: MembershipTier, userId: string): Promise<CheckoutState> {
  if (!isPayPalSubscriptionId(id)) {
    throw new BillingError("invalidRequest", 400);
  }
  const subscription = await getPayPalSubscription(id);
  if (subscription.custom_id !== userId) {
    throw new BillingError("subscriptionBelongsToAnotherAccount", 409);
  }
  if (subscription.plan_id !== getPayPalPlanId(tier)) {
    throw new BillingError("planMismatch", 409);
  }
  if (subscription.status === "APPROVAL_PENDING") {
    return { status: "pending" };
  }
  if (subscription.status === "APPROVED") {
    return { status: "processing" };
  }
  if (["CANCELLED", "EXPIRED"].includes(subscription.status) && !subscription.billing_info?.last_payment) {
    return { status: "closed" };
  }
  return { status: "completed", subscriptionId: id };
}

export async function cancelPayPalSubscription(id: string): Promise<void> {
  await requestPayPal<void>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: "Customer requested cancellation" }),
  });
}

export async function getPayPalTransaction(subscriptionId: string, transactionId: string, saleAt: string): Promise<PayPalTransaction> {
  const query = new URLSearchParams({
    start_time: new Date(Date.parse(saleAt) - 86_400_000).toISOString(),
    end_time: new Date().toISOString(),
  });
  const result = await requestPayPal<{ transactions: PayPalTransaction[] }>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/transactions?${query}`,
  );
  const transaction = result.transactions.find((candidate) => candidate.id === transactionId);
  if (!transaction || transaction.status !== "COMPLETED") {
    throw new Error("PayPal completed transaction is not available yet");
  }
  return transaction;
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown): Promise<void> {
  const fields = {
    auth_algo: "paypal-auth-algo",
    cert_url: "paypal-cert-url",
    transmission_id: "paypal-transmission-id",
    transmission_sig: "paypal-transmission-sig",
    transmission_time: "paypal-transmission-time",
  };
  const evidence = Object.fromEntries(Object.entries(fields).map(([key, header]) => [key, headers.get(header)]));
  if (Object.values(evidence).some((value) => !value)) {
    throw new BillingError("webhookSignatureFailed", 400);
  }
  const config = getPayPalConfig();
  if (!config) {
    throw new BillingError("configurationMissing", 503);
  }
  const result = await requestPayPal<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({ ...evidence, webhook_id: config.webhookId, webhook_event: event }),
  });
  if (result.verification_status !== "SUCCESS") {
    throw new BillingError("webhookSignatureFailed", 400);
  }
}
