"use client";

import type { FC } from "react";
import { useState } from "react";
import { PaymentSession } from "./payment-session";
import type { CheckoutConfig } from "@/lib/billing/provider";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { MembershipTier } from "@/lib/billing/types";

type SubscriptionButtonProps = {
  checkout: CheckoutConfig;
  tier: MembershipTier;
  signedIn: boolean;
  current: boolean;
};

type ActivateResponse = {
  error?: string;
  status?: string;
};

const SubscriptionButton: FC<SubscriptionButtonProps> = ({
  checkout,
  tier,
  signedIn,
  current,
}) => {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function createSubscription(): Promise<string> {
    try {
      const response = await fetch("/api/billing/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-locale": locale },
        body: JSON.stringify({ provider: checkout.provider, tier }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; subscriptionId?: string } | null;
      if (!response.ok || !payload?.subscriptionId) {
        setFailure(payload?.error ?? t("api.createFailed"));
        throw new Error("Subscription creation failed");
      }
      return payload.subscriptionId;
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

  if (current) {
    return <p className="text-sm font-medium text-primary">{t("currentPlan")}</p>;
  }

  if (!signedIn) {
    return <p className="text-sm text-muted-foreground">{t("signInRequired")}</p>;
  }

  if (!checkout.available || !checkout.availableTiers.includes(tier)) {
    return <p className="text-sm text-muted-foreground">{t("unavailable")}</p>;
  }

  if (success) {
    return <p className="text-sm font-medium text-primary">{message}</p>;
  }

  return (
    <PaymentSession
      provider={checkout.provider}
      createSubscription={createSubscription}
      onApprove={onApprove}
      onCancel={() => { setFailure(null); setMessage(t("cancelled")); }}
      onError={() => { setMessage(null); setFailure((value) => value ?? t("paymentFailed")); }}
    >
      {({ labels, pending, failed, start, cancel }) => {
        let label = labels.subscribe;
        if (confirming) label = t("confirming");
        else if (pending) label = labels.processing;
        return (
          <div className="grid gap-2">
            <Button
              type="button" size="lg"
              onClick={() => { setMessage(null); setFailure(null); void start(); }}
              onKeyDown={(event) => { if (event.key === "Escape") cancel(); }}
              disabled={pending || confirming}
            >
              {label}
            </Button>
            {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
            {(failure || failed) && <p role="alert" className="text-sm text-destructive">{failure ?? t("paymentFailed")}</p>}
          </div>
        );
      }}
    </PaymentSession>
  );
};

SubscriptionButton.displayName = "SubscriptionButton";

export { SubscriptionButton };
