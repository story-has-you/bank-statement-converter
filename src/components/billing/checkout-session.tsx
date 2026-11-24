"use client";

import { useState, type FC, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { CheckoutResult, PaymentProviderId } from "@/lib/billing/provider";

type CheckoutSessionProps = {
  provider: PaymentProviderId;
  createCheckout: () => Promise<CheckoutResult>;
  onReady: () => void;
  onError: (code: "CHECKOUT_CREATE_FAILED" | "CHECKOUT_REDIRECT_FAILED") => void;
  children: (session: { labels: { subscribe: string; processing: string }; pending: boolean; start: () => Promise<void> }) => ReactNode;
};

const CheckoutSession: FC<CheckoutSessionProps> = ({ provider, createCheckout, onReady, onError, children }) => {
  const t = useTranslations("Billing");
  const [pending, setPending] = useState(false);
  async function start(): Promise<void> {
    if (pending) {
      return;
    }
    setPending(true);
    let errorCode: Parameters<CheckoutSessionProps["onError"]>[0] = "CHECKOUT_CREATE_FAILED";
    try {
      const result = await createCheckout();
      errorCode = "CHECKOUT_REDIRECT_FAILED";
      onReady();
      window.location.assign(result.checkoutUrl);
    } catch {
      setPending(false);
      onError(errorCode);
    }
  }
  const name = t(`providers.${provider}`);
  return children({
    labels: {
      subscribe: t("subscribeWith", { provider: name }),
      processing: t("openingProvider", { provider: name }),
    },
    pending,
    start,
  });
};

CheckoutSession.displayName = "CheckoutSession";
export { CheckoutSession };
