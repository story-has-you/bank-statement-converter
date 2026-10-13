"use client";

import { useState, type FC, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { CheckoutResult } from "@/lib/billing/provider";

type CheckoutSessionProps = {
  createCheckout: () => Promise<CheckoutResult>;
  onError: () => void;
  children: (session: { labels: { subscribe: string; processing: string }; pending: boolean; start: () => Promise<void> }) => ReactNode;
};

const CreemCheckoutSession: FC<CheckoutSessionProps> = ({ createCheckout, onError, children }) => {
  const t = useTranslations("Creem");
  const [pending, setPending] = useState(false);
  async function start(): Promise<void> {
    if (pending) return;
    setPending(true);
    try {
      const result = await createCheckout();
      window.location.assign(result.checkoutUrl);
    } catch {
      setPending(false);
      onError();
    }
  }
  return children({ labels: { subscribe: t("subscribe"), processing: t("processing") }, pending, start });
};

CreemCheckoutSession.displayName = "CreemCheckoutSession";
export { CreemCheckoutSession };
