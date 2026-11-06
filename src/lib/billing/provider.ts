import type { MembershipTier, SubscriptionStatus } from "./types";

export type PaymentProviderId = "waffo";
export type BillingProviderId = PaymentProviderId | "creem" | "paypal";

type CheckoutAvailability = { availableTiers: MembershipTier[]; available: boolean };

export type CheckoutConfig = CheckoutAvailability & { provider: "waffo"; settings: { environment: "test" | "prod" } };

export type CheckoutResult = {
  provider: PaymentProviderId;
  checkoutId: string;
  checkoutUrl: string;
};

export type CreatedCheckout = CheckoutResult & { expiresAt: string | null };

export type CheckoutAttempt = { id: string; amount: string };

export type CheckoutState = { status: "pending" | "processing" | "closed" | "unknown" } | { status: "completed"; subscriptionId: string };

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

type EventBase = {
  provider: PaymentProviderId;
  id: string;
  at: string;
  subscription: ProviderSubscription;
};

export type BillingEvent = EventBase &
  (
    | { type: "subscription-cancelled" }
    | {
        type: "subscription-paid";
        amount: string;
        recurringAmount: string;
        originalAmount: string;
        discountAmount: string;
        providerDiscountId: string | null;
        currencyCode: string;
        paidAt: string;
      }
    | { type: "subscription-status-changed" }
    | { type: "subscription-resumed" }
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
  createCheckout(tier: MembershipTier, user: CheckoutUser, returnUrl: string, attempt: CheckoutAttempt): Promise<CreatedCheckout>;
  resolveCheckout(checkoutId: string, tier: MembershipTier, userId: string, expiresAt?: string | null): Promise<CheckoutState>;
  getSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  parseWebhook(headers: Headers, body: string): Promise<BillingNotification | null>;
}
