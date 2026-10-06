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
  const [success, setSuccess] = useState(false);

  const { error: sessionError, isPending, handleClick, handleCancel } =
    usePayPalSubscriptionPaymentSession({
      presentationMode: "popup",
      createSubscription: async () => {
        const response = await fetch("/api/paypal/subscriptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-app-locale": locale },
          body: JSON.stringify({ tier }),
        });
        const payload = (await response.json()) as {
          error?: string;
          subscriptionId?: string;
        };

        if (!response.ok || !payload.subscriptionId) {
          throw new Error(payload.error ?? t("paymentFailed"));
        }

        return { subscriptionId: payload.subscriptionId };
      },
      onApprove: async (data) => {
        try {
          await activateSubscription(data.subscriptionId);
        } catch {
          setMessage(t("activationFailed"));
        }
      },
      onCancel: () => {
        setMessage(t("cancelled"));
      },
      onError: () => setMessage(t("paymentFailed")),
    });

  async function activateSubscription(subscriptionId: string): Promise<void> {
    const response = await fetch("/api/paypal/subscriptions/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-locale": locale },
      body: JSON.stringify({ subscriptionId, tier }),
    });
    const payload = (await response.json()) as ActivateResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? t("activationFailed"));
    }

    setSuccess(true);
    setMessage(t("activated"));
    router.refresh();
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

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        size="lg"
        onClick={() => void handleClick()}
        onKeyDown={(event) => {
          if (event.key === "Escape") handleCancel();
        }}
        disabled={isPending}
      >
        {isPending ? t("processing") : t("subscribe")}
      </Button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      {sessionError && <p role="alert" className="text-sm text-destructive">{t("paymentFailed")}</p>}
    </div>
  );
};

PayPalSubscriptionButton.displayName = "PayPalSubscriptionButton";

export { PayPalSubscriptionButton };
