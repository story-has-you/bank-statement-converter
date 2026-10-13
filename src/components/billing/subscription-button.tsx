"use client";

import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { PaymentProviderIcon } from "@/components/billing/payment-provider-icon";
import { CreemCheckoutSession } from "@/components/billing/providers/creem/checkout-session";
import type { CheckoutConfig, CheckoutResult } from "@/lib/billing/provider";
import { isCheckoutResult, readBillingResponse } from "@/lib/billing/response";
import type { MembershipTier } from "@/lib/billing/types";

type SubscriptionButtonProps = { checkout: CheckoutConfig; tier: MembershipTier };

const SubscriptionButton: FC<SubscriptionButtonProps> = ({ checkout, tier }) => {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function createCheckout(): Promise<CheckoutResult> {
    try {
      const response = await fetch("/api/billing/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-locale": locale },
        body: JSON.stringify({ provider: checkout.provider, tier }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isCheckoutResult(payload)) {
        if (mounted.current) setFailure(readBillingResponse(payload).error ?? t("api.createFailed"));
        throw new Error("Subscription creation failed");
      }
      return payload;
    } catch (error) {
      if (mounted.current) setFailure((currentFailure) => currentFailure ?? t("api.createFailed"));
      throw error;
    }
  }

  if (!checkout.available || !checkout.availableTiers.includes(tier)) {
    const unavailable = t("providerUnavailable", { provider: "Creem" });
    return (
      <Button type="button" size="lg" className="w-full min-w-0" disabled aria-label={unavailable} title={unavailable}>
        <PaymentProviderIcon data-icon="inline-start" />
        <span className="truncate">Creem</span>
      </Button>
    );
  }

  return (
    <CreemCheckoutSession
      createCheckout={createCheckout}
      onError={() => {
        if (mounted.current) setFailure((value) => value ?? t("paymentFailed"));
      }}
    >
      {({ labels, pending, start }) => {
        const label = pending ? labels.processing : labels.subscribe;
        return (
          <div className="grid min-w-0 gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full min-w-0"
              aria-label={label}
              title={label}
              onClick={() => {
                setFailure(null);
                void start();
              }}
              disabled={pending}
            >
              <PaymentProviderIcon data-icon="inline-start" />
              <span className="truncate">{pending ? label : "Creem"}</span>
            </Button>
            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
          </div>
        );
      }}
    </CreemCheckoutSession>
  );
};

SubscriptionButton.displayName = "SubscriptionButton";

export { SubscriptionButton };
