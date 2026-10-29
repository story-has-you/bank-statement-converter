"use client";

import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { PaymentProviderIcon } from "@/components/billing/payment-provider-icon";
import { CheckoutSession } from "@/components/billing/checkout-session";
import type { CheckoutConfig, CheckoutResult } from "@/lib/billing/provider";
import { isCheckoutResult, readBillingResponse } from "@/lib/billing/response";
import type { MembershipTier } from "@/lib/billing/types";

type SubscriptionButtonProps = { checkout: CheckoutConfig; tier: MembershipTier; renewalConsent: boolean };

const SubscriptionButton: FC<SubscriptionButtonProps> = ({ checkout, tier, renewalConsent }) => {
  const t = useTranslations("Billing");
  const plans = useTranslations("UsageTiers.plans");
  const locale = useLocale();
  const providerName = t(`providers.${checkout.provider}`);
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
        body: JSON.stringify({ provider: checkout.provider, tier, renewalConsent }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isCheckoutResult(payload)) {
        if (mounted.current) {
          const failure = readBillingResponse(payload);
          const message = failure.error ?? t("api.createFailed");
          const pending = failure.pendingCheckout;
          setFailure(
            pending
              ? `${message} ${t("pendingCheckout", { provider: t(`providers.${pending.provider}`), tier: plans(`${pending.tier}.name`) })}`
              : message,
          );
        }
        throw new Error("Subscription creation failed");
      }
      return payload;
    } catch (error) {
      if (mounted.current) {
        setFailure((currentFailure) => currentFailure ?? t("api.createFailed"));
      }
      throw error;
    }
  }

  if (!checkout.available || !checkout.availableTiers.includes(tier)) {
    const unavailable = t("providerUnavailable", { provider: providerName });
    return (
      <Button type="button" size="lg" className="w-full min-w-0" disabled aria-label={unavailable} title={unavailable}>
        <PaymentProviderIcon provider={checkout.provider} data-icon="inline-start" />
        <span className="truncate">{providerName}</span>
      </Button>
    );
  }

  return (
    <CheckoutSession
      provider={checkout.provider}
      createCheckout={createCheckout}
      onError={() => {
        if (mounted.current) {
          setFailure((value) => value ?? t("paymentFailed"));
        }
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
              disabled={pending || !renewalConsent}
            >
              <PaymentProviderIcon provider={checkout.provider} data-icon="inline-start" />
              <span className="truncate">{pending ? label : providerName}</span>
            </Button>
            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
          </div>
        );
      }}
    </CheckoutSession>
  );
};

SubscriptionButton.displayName = "SubscriptionButton";

export { SubscriptionButton };
