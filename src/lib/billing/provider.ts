import type { MembershipTier, SubscriptionStatus } from "./types";

export type PaymentProviderId = "paypal" | "creem";

type CheckoutAvailability = { availableTiers: MembershipTier[]; available: boolean };

export type CheckoutConfig = CheckoutAvailability &
  ({ provider: "paypal"; settings: { clientId: string | null; environment: "sandbox" | "production" } } | { provider: "creem"; settings: { environment: "test" | "production" } });

export type CheckoutResult = { provider: "paypal"; subscriptionId: string } | { provider: "creem"; checkoutId: string; checkoutUrl: string };

export type CheckoutUser = { id: string; email: string };

export type ProviderSubscription = {
  subscriptionId: string;
  planId: string;
  userId: string;
  tier: MembershipTier;
  status: SubscriptionStatus;
  payerId: string | null;
  subscriberEmail: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

type EventBase = { provider: PaymentProviderId; id: string; at: string; subscription: ProviderSubscription };

export type BillingEvent = EventBase &
  (
    | { type: "subscription-activated"; amount: string; currencyCode: string }
    | { type: "subscription-cancelled" }
    | { type: "subscription-paid"; amount: string; currencyCode: string; paidAt: string }
    | { type: "subscription-status-changed" }
    | { type: "subscription-renewed"; saleAt: string | null; paidAt: string | null }
  );

export type BillingNotification = { provider: PaymentProviderId; id: string; at: string; type: BillingEvent["type"]; subscriptionId: string; resolve: () => Promise<BillingEvent> };

export interface PaymentProvider {
  id: PaymentProviderId;
  getCheckoutConfig(): CheckoutConfig;
  isConfigured(): boolean;
  getPlanId(tier: MembershipTier): string | null;
  isSubscriptionId(value: unknown): value is string;
  createCheckout(tier: MembershipTier, user: CheckoutUser, returnUrl: string): Promise<CheckoutResult>;
  resolveCheckout?(checkoutId: string, tier: MembershipTier, userId: string): Promise<string | null>;
  getSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  parseWebhook(headers: Headers, body: string): Promise<BillingNotification | null>;
}
