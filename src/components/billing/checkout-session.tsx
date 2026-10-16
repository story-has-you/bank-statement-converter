"use client";

import { useState, type FC, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { CheckoutResult, PaymentProviderId } from "@/lib/billing/provider";

type CheckoutSessionProps = {
  provider: PaymentProviderId;
  createCheckout: () => Promise<CheckoutResult>;
  onError: () => void;
  children: (session: { labels: { subscribe: string; processing: string }; pending: boolean; start: () => Promise<void> }) => ReactNode;
};

const CheckoutSession: FC<CheckoutSessionProps> = ({ provider, createCheckout, onError, children }) => {
  const t = useTranslations("Billing");
  const [pending, setPending] = useState(false);
  async function start(): Promise<void> {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const result = await createCheckout();
      window.location.assign(result.checkoutUrl);
    } catch {
      setPending(false);
      onError();
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
