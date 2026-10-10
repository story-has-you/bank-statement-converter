"use client";

import type { FC } from "react";
import { useState } from "react";
import { usePayPalSubscriptionPaymentSession } from "@paypal/react-paypal-js/sdk-v6";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { MembershipTier } from "@/lib/billing/types";

type PayPalSubscriptionButtonProps = {
  clientId: string | null;
  planId: string | null;
  tier: MembershipTier;
  signedIn: boolean;
  current: boolean;
};

type ActivateResponse = {
  error?: string;
  status?: string;
};

const PayPalSubscriptionButton: FC<PayPalSubscriptionButtonProps> = ({
  clientId,
  planId,
  tier,
  signedIn,
  current,
}) => {
  const t = useTranslations("PayPal");
  const locale = useLocale();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { error: sessionError, isPending, handleClick, handleCancel } =
    usePayPalSubscriptionPaymentSession({
      presentationMode: "popup",
      createSubscription: async () => {
        try {
          const response = await fetch("/api/paypal/subscriptions/create", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-app-locale": locale },
            body: JSON.stringify({ tier }),
          });
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            subscriptionId?: string;
          } | null;

          if (!response.ok || !payload?.subscriptionId) {
            setFailure(typeof payload?.error === "string" ? payload.error : t("api.createFailed"));
            throw new Error("Subscription creation failed");
          }

          return { subscriptionId: payload.subscriptionId };
        } catch (error) {
          setFailure((currentFailure) => currentFailure ?? t("api.createFailed"));
          throw error;
        }
      },
      onApprove: async (data) => {
        setFailure(null);
        setConfirming(true);
        setMessage(t("confirming"));
        try {
          for (let attempt = 0; attempt < 15; attempt += 1) {
            if (await isSubscriptionActive(data.subscriptionId)) {
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
      },
      onCancel: () => {
        setFailure(null);
        setMessage(t("cancelled"));
      },
      onError: () => {
        setMessage(null);
        setFailure((currentFailure) => currentFailure ?? t("paymentFailed"));
      },
    });

  async function isSubscriptionActive(subscriptionId: string): Promise<boolean> {
    const response = await fetch("/api/paypal/subscriptions/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-locale": locale },
      body: JSON.stringify({ subscriptionId, tier }),
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

  if (!clientId || !planId) {
    return <p className="text-sm text-muted-foreground">{t("unavailable")}</p>;
  }

  if (success) {
    return <p className="text-sm font-medium text-primary">{message}</p>;
  }

  let buttonLabel = t("subscribe");
  if (confirming) buttonLabel = t("confirming");
  else if (isPending) buttonLabel = t("processing");

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        size="lg"
        onClick={() => {
          setMessage(null);
          setFailure(null);
          void handleClick();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") handleCancel();
        }}
        disabled={isPending || confirming}
      >
        {buttonLabel}
      </Button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      {(failure || sessionError) && <p role="alert" className="text-sm text-destructive">{failure ?? t("paymentFailed")}</p>}
    </div>
  );
};

PayPalSubscriptionButton.displayName = "PayPalSubscriptionButton";

export { PayPalSubscriptionButton };
