"use client";

import type { ReactNode } from "react";
import type { CheckoutResult, PaymentProviderId } from "@/lib/billing/provider";
import { CreemCheckoutSession } from "./providers/creem/checkout-session";
import { PayPalSubscriptionSession } from "./providers/paypal/subscription-session";

export type PaymentSessionState = { labels: { subscribe: string; processing: string }; pending: boolean; failed: boolean; start: () => Promise<void>; cancel: () => void };

export type PaymentSessionProps = {
  provider: PaymentProviderId;
  createCheckout: () => Promise<CheckoutResult>;
  onApprove: (subscriptionId: string) => Promise<void>;
  onCancel: () => void;
  onError: () => void;
  children: (session: PaymentSessionState) => ReactNode;
};

const sessions = { paypal: PayPalSubscriptionSession, creem: CreemCheckoutSession };

export function PaymentSession(props: PaymentSessionProps) {
  const Session = sessions[props.provider];
  return <Session {...props} />;
}
