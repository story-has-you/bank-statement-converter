"use client";

import type { ReactNode } from "react";
import type { PaymentProviderId } from "@/lib/billing/provider";
import { PayPalSubscriptionSession } from "./providers/paypal/subscription-session";

export type PaymentSessionState = {
  labels: { subscribe: string; processing: string };
  pending: boolean;
  failed: boolean;
  start: () => Promise<void>;
  cancel: () => void;
};

export type PaymentSessionProps = {
  provider: PaymentProviderId;
  createSubscription: () => Promise<string>;
  onApprove: (subscriptionId: string) => Promise<void>;
  onCancel: () => void;
  onError: () => void;
  children: (session: PaymentSessionState) => ReactNode;
};

const sessions = { paypal: PayPalSubscriptionSession };

export function PaymentSession(props: PaymentSessionProps) {
  const Session = sessions[props.provider];
  return <Session {...props} />;
}
