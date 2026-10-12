"use client";

import { useState, type FC } from "react";
import { useTranslations } from "next-intl";
import type { PaymentSessionProps } from "@/components/billing/payment-session";

const CreemCheckoutSession: FC<PaymentSessionProps> = ({ createCheckout, onError, children }) => {
  const t = useTranslations("Creem");
  const [pending, setPending] = useState(false);
  async function start(): Promise<void> {
    if (pending) return;
    setPending(true);
    try {
      const result = await createCheckout();
      if (result.provider !== "creem") throw new Error("Unexpected checkout provider");
      window.location.assign(result.checkoutUrl);
    } catch {
      setPending(false);
      onError();
    }
  }
  return children({ labels: { subscribe: t("subscribe"), processing: t("processing") }, pending, failed: false, start, cancel: () => {} });
};

CreemCheckoutSession.displayName = "CreemCheckoutSession";
export { CreemCheckoutSession };
