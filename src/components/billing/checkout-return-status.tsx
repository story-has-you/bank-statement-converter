"use client";

import { useEffect, useState, type FC } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { usePublicAccount } from "@/components/account/public-account-provider";
import { Button } from "@/components/ui/button";
import { readBillingResponse } from "@/lib/billing/response";
import type { MembershipTier } from "@/lib/billing/types";
import type { PaymentProviderId } from "@/lib/billing/provider";

type ReturnState = "pending" | "active" | "delayed" | "failed";
const CheckoutReturnStatus: FC<{
  provider: PaymentProviderId;
  checkoutId: string;
  tier: MembershipTier;
}> = ({ provider, checkoutId, tier }) => {
  const t = useTranslations("BillingReturn");
  const locale = useLocale();
  const router = useRouter();
  const { refresh: refreshAccount } = usePublicAccount();
  const [state, setState] = useState<ReturnState>("pending");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check(): Promise<void> {
      attempts += 1;
      try {
        const response = await fetch("/api/billing/subscriptions/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-app-locale": locale },
          body: JSON.stringify({ provider, checkoutId, tier }),
          signal: controller.signal,
        });
        const payload = readBillingResponse(await response.json());
        if (controller.signal.aborted) {
          return;
        }
        if (response.ok && response.status !== 202 && payload.status === "ACTIVE") {
          setState("active");
          void refreshAccount();
          router.refresh();
          return;
        }
        if (response.status !== 202 || payload.status !== "PENDING") {
          setError(payload.error ?? t("failed"));
          setState("failed");
          return;
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
      }
      if (attempts >= 15) {
        setState("delayed");
      } else {
        timer = setTimeout(check, 2_000);
      }
    }
    timer = setTimeout(check, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [provider, checkoutId, tier, locale, retry, router, t, refreshAccount]);
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
};
CheckoutReturnStatus.displayName = "CheckoutReturnStatus";
export { CheckoutReturnStatus };
