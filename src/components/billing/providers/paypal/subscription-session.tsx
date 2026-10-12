"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { PaymentSessionContent } from "@/components/billing/payment-session-content";
import { usePayPalSubscriptionPaymentSession } from "@paypal/react-paypal-js/sdk-v6";
import type { PaymentSessionProps } from "@/components/billing/payment-session";

/** Keeps SDK loading separate from the checkout session, including same-tick clicks. */
const PayPalSubscriptionSession: FC<PaymentSessionProps> = ({ createCheckout, onApprove, onCancel, onError, children }) => {
  const t = useTranslations("PayPal");
  const [busy, setBusy] = useState(false);
  const active = useRef<{ checkoutRequested: boolean } | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function release(): void {
    active.current = null;
    if (mounted.current) setBusy(false);
  }

  const { error, isPending, handleClick, handleCancel } = usePayPalSubscriptionPaymentSession({
    presentationMode: "popup",
    createSubscription: async () => {
      if (active.current) active.current.checkoutRequested = true;
      const checkout = await createCheckout();
      if (checkout.provider !== "paypal") throw new Error("Unexpected checkout provider");
      return { subscriptionId: checkout.subscriptionId };
    },
    onApprove: async (data) => {
      try {
        if (mounted.current) await onApprove(data.subscriptionId);
      } finally {
        release();
      }
    },
    onCancel: () => {
      release();
      if (mounted.current) onCancel();
    },
    onError: () => {
      release();
      if (mounted.current) onError();
    },
  });

  const start = useCallback(async (): Promise<void> => {
    if (active.current || isPending || !mounted.current) return;
    const operation = { checkoutRequested: false };
    active.current = operation;
    setBusy(true);
    try {
      await handleClick();
      // A missing SDK session returns without requesting a checkout or terminal callback.
      if (active.current === operation && !operation.checkoutRequested) release();
    } catch {
      if (active.current === operation) {
        if (mounted.current) onError();
        release();
      }
    }
    // Session start can resolve before approval; only terminal callbacks release the lock.
  }, [handleClick, isPending, onError]);

  return (
    <PaymentSessionContent session={{ labels: { subscribe: t("subscribe"), processing: t("processing") }, pending: isPending || busy, failed: Boolean(error), start, cancel: handleCancel }}>
      {children}
    </PaymentSessionContent>
  );
};

PayPalSubscriptionSession.displayName = "PayPalSubscriptionSession";
export { PayPalSubscriptionSession };
