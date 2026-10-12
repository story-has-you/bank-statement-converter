"use client";

import type { FC } from "react";
import { useState } from "react";
import { PaymentSession } from "./payment-session";
import type { CheckoutConfig, CheckoutResult } from "@/lib/billing/provider";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PaymentProviderIcon } from "@/components/billing/payment-provider-icon";
import type { MembershipTier } from "@/lib/billing/types";

type SubscriptionButtonProps = { checkout: CheckoutConfig; tier: MembershipTier };

type ActivateResponse = { error?: string; status?: string };

const SubscriptionButton: FC<SubscriptionButtonProps> = ({ checkout, tier }) => {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const router = useRouter();
  const providerName = checkout.provider === "creem" ? "Creem" : "PayPal";
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function createCheckout(): Promise<CheckoutResult> {
    try {
      const response = await fetch("/api/billing/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-locale": locale },
        body: JSON.stringify({ provider: checkout.provider, tier }),
      });
      const payload = (await response.json().catch(() => null)) as (CheckoutResult & { error?: string }) | null;
      const validCheckout = payload?.provider === "paypal" ? Boolean(payload.subscriptionId) : Boolean(payload?.checkoutId && payload?.checkoutUrl);
      if (!response.ok || !payload || payload.provider !== checkout.provider || !validCheckout) {
        setFailure(payload?.error ?? t("api.createFailed"));
        throw new Error("Subscription creation failed");
      }
      return payload;
    } catch (error) {
      setFailure((currentFailure) => currentFailure ?? t("api.createFailed"));
      throw error;
    }
  }

  async function onApprove(subscriptionId: string): Promise<void> {
    setFailure(null);
    setConfirming(true);
    setMessage(t("confirming"));
    try {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        if (await isSubscriptionActive(subscriptionId)) {
          setSuccess(true);
          setMessage(t("activated"));
          router.refresh();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      setMessage(t("confirmationDelayed"));
    } catch {
      setMessage(null);
      setFailure((currentFailure) => currentFailure ?? t("activationFailed"));
    } finally {
      setConfirming(false);
    }
  }

  async function isSubscriptionActive(subscriptionId: string): Promise<boolean> {
    const response = await fetch("/api/billing/subscriptions/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-locale": locale },
      body: JSON.stringify({ provider: checkout.provider, subscriptionId, tier }),
    });
    const payload = (await response.json().catch(() => null)) as ActivateResponse | null;

    if (response.status === 202 && payload?.status === "PENDING") return false;
    if (!response.ok) {
      setFailure(typeof payload?.error === "string" ? payload.error : t("activationFailed"));
      throw new Error("Subscription activation check failed");
    }
    if (payload?.status !== "ACTIVE") {
      setFailure(t("invalidStatusResponse"));
      throw new Error("Unexpected subscription status");
    }

    return true;
  }

  if (!checkout.available || !checkout.availableTiers.includes(tier)) {
    return <p className="text-sm text-muted-foreground">{t("providerUnavailable", { provider: checkout.provider === "creem" ? "Creem" : "PayPal" })}</p>;
  }

  if (success) {
    return <p className="text-sm font-medium text-primary">{message}</p>;
  }

  return (
    <PaymentSession
      provider={checkout.provider}
      createCheckout={createCheckout}
      onApprove={onApprove}
      onCancel={() => {
        setFailure(null);
        setMessage(t("cancelled"));
      }}
      onError={() => {
        setMessage(null);
        setFailure((value) => value ?? t("paymentFailed"));
      }}
    >
      {({ labels, pending, failed, start, cancel }) => {
        let label = labels.subscribe;
        if (confirming) label = t("confirming");
        else if (pending) label = labels.processing;
        return (
          <div className="grid min-w-0 gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full min-w-0"
              aria-label={label}
              title={label}
              onClick={() => {
                setMessage(null);
                setFailure(null);
                void start();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancel();
              }}
              disabled={pending || confirming}
            >
              <PaymentProviderIcon provider={checkout.provider} data-icon="inline-start" />
              <span className="truncate">{pending || confirming ? label : providerName}</span>
            </Button>
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
            {(failure || failed) && (
              <p role="alert" className="text-sm text-destructive">
                {failure ?? t("paymentFailed")}
              </p>
            )}
          </div>
        );
      }}
    </PaymentSession>
  );
};

SubscriptionButton.displayName = "SubscriptionButton";

export { SubscriptionButton };
