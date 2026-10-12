"use client";

import { useTranslations } from "next-intl";
import type { FC } from "react";
import { usePayPalSubscriptionPaymentSession } from "@paypal/react-paypal-js/sdk-v6";
import type { PaymentSessionProps } from "@/components/billing/payment-session";

/** 将 PayPal SDK 会话转换为通用交互状态和事件。 */
const PayPalSubscriptionSession: FC<PaymentSessionProps> = ({ createSubscription, onApprove, onCancel, onError, children }) => {
  const t = useTranslations("PayPal");
  const { error, isPending, handleClick, handleCancel } = usePayPalSubscriptionPaymentSession({
    presentationMode: "popup",
    createSubscription: async () => ({ subscriptionId: await createSubscription() }),
    onApprove: (data) => onApprove(data.subscriptionId),
    onCancel,
    onError,
  });
  return children({ labels: { subscribe: t("subscribe"), processing: t("processing") }, pending: isPending, failed: Boolean(error), start: async () => { await handleClick(); }, cancel: handleCancel });
};

PayPalSubscriptionSession.displayName = "PayPalSubscriptionSession";
export { PayPalSubscriptionSession };
