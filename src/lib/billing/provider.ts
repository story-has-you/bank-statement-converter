import type { MembershipTier, SubscriptionStatus } from "./types";

export type PaymentProviderId = "paypal";

export type CheckoutConfig = {
  provider: PaymentProviderId;
  availableTiers: MembershipTier[];
  available: boolean;
  settings: { clientId: string | null; environment: "sandbox" | "production" };
};

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

type EventBase = {
  provider: PaymentProviderId;
  id: string;
  at: string;
  subscription: ProviderSubscription;
};

export type BillingEvent = EventBase & (
  | { type: "subscription-activated"; amount: string; currencyCode: string }
  | { type: "subscription-cancelled" }
  | { type: "subscription-renewed"; saleAt: string | null; paidAt: string | null }
);

export type BillingNotification = {
  provider: PaymentProviderId;
  id: string;
  at: string;
  type: BillingEvent["type"];
  subscriptionId: string;
  resolve: () => Promise<BillingEvent>;
};

export interface PaymentProvider {
  id: PaymentProviderId;
  getCheckoutConfig(): CheckoutConfig;
  isConfigured(): boolean;
  getPlanId(tier: MembershipTier): string | null;
  isSubscriptionId(value: unknown): value is string;
  createSubscription(tier: MembershipTier, userId: string): Promise<string>;
  getSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  parseWebhook(headers: Headers, body: string): Promise<BillingNotification | null>;
}
