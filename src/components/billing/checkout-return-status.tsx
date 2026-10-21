"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { usePublicAccount } from "@/components/account/public-account-provider";
import { Button } from "@/components/ui/button";
import { readBillingResponse } from "@/lib/billing/response";
import { startStatusPolling, type PollState } from "@/lib/billing/status-polling";
import type { MembershipTier } from "@/lib/billing/types";
import type { PaymentProviderId } from "@/lib/billing/provider";

type ReturnState = "pending" | "active" | "delayed" | "failed";
type CheckoutReturnStatusProps = {
  provider: PaymentProviderId;
  checkoutId: string;
  tier: MembershipTier;
};

export function CheckoutReturnStatus(props: CheckoutReturnStatusProps) {
  const { user } = usePublicAccount();
  const locale = useLocale();
  return <CheckoutReturnCheck key={JSON.stringify([user?.id, locale, props.provider, props.checkoutId, props.tier])} {...props} />;
}

function CheckoutReturnCheck({ provider, checkoutId, tier }: CheckoutReturnStatusProps) {
  const t = useTranslations("BillingReturn");
  const locale = useLocale();
  const router = useRouter();
  const { refresh: refreshAccount } = usePublicAccount();
  const [state, setState] = useState<ReturnState>("pending");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const handleState = useEffectEvent((next: PollState) => {
    setError(next.kind === "failed" ? next.error : null);
    setState(next.kind === "done" ? "active" : next.kind);
    if (next.kind === "done") {
      void refreshAccount();
      router.refresh();
    }
  });
  useEffect(() => {
    return startStatusPolling({
      initialDelayMs: 0,
      async read(signal) {
        const response = await fetch("/api/billing/subscriptions/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-app-locale": locale },
          body: JSON.stringify({ provider, checkoutId, tier }),
          signal,
        });
        const payload = readBillingResponse(await response.json());
        if (response.ok && response.status !== 202 && payload.status === "ACTIVE") {
          return { kind: "done" };
        }
        if (response.status !== 202 || payload.status !== "PENDING") {
          return { kind: "failed", error: payload.error ?? t("failed") };
        }
        return { kind: "pending" };
      },
      onState(next) {
        handleState(next);
      },
    });
  }, [provider, checkoutId, tier, locale, retry, t]);
  return (
    <div className="grid gap-4">
      <p role={state === "failed" ? "alert" : "status"}>{error ?? t(state)}</p>
      {(state === "failed" || state === "delayed") && (
        <Button
          onClick={() => {
            setError(null);
            setState("pending");
            setRetry((value) => value + 1);
          }}
        >
          {t("retry")}
        </Button>
      )}
      <Link href="/account" className="text-sm underline">
        {t("account")}
      </Link>
    </div>
  );
}
