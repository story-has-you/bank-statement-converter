"use client";

import { useEffect, useState, type FC } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { isMembershipTier } from "@/lib/billing/config";

type ReturnState = "pending" | "active" | "delayed" | "failed";
const BillingReturnStatus: FC<{ signedIn: boolean }> = ({ signedIn }) => {
  const t = useTranslations("BillingReturn");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const checkoutId = params.get("checkout_id");
  const tier = params.get("tier");
  const valid = Boolean(checkoutId && /^ch_[A-Za-z0-9]{1,64}$/.test(checkoutId) && isMembershipTier(tier));
  const [state, setState] = useState<ReturnState>("pending");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!valid || !signedIn) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check(): Promise<void> {
      attempts += 1;
      try {
        const response = await fetch("/api/billing/subscriptions/activate", {
          method: "POST", headers: { "Content-Type": "application/json", "x-app-locale": locale },
          body: JSON.stringify({ provider: "creem", checkoutId, tier }), signal: controller.signal,
        });
        const payload = await response.json() as { status?: string; error?: string };
        if (controller.signal.aborted) return;
        if (response.ok && response.status !== 202 && payload.status === "ACTIVE") {
          setState("active"); router.refresh(); return;
        }
        if (response.status !== 202 || payload.status !== "PENDING") {
          setError(payload.error ?? t("failed")); setState("failed"); return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (attempts >= 15) setState("delayed");
      else timer = setTimeout(check, 2_000);
    }
    timer = setTimeout(check, 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [checkoutId, tier, valid, signedIn, locale, retry, router, t]);
  if (!signedIn) return <p role="status">{t("signInRequired")}</p>;
  if (!valid) return <p role="alert">{t("invalidReturn")}</p>;
  return <div className="grid gap-4">
    <p role={state === "failed" ? "alert" : "status"}>{error ?? t(state)}</p>
    {(state === "failed" || state === "delayed") && <Button onClick={() => { setError(null); setState("pending"); setRetry((value) => value + 1); }}>{t("retry")}</Button>}
    <Link href="/account" className="text-sm underline">{t("account")}</Link>
  </div>;
};
BillingReturnStatus.displayName = "BillingReturnStatus";
export { BillingReturnStatus };
