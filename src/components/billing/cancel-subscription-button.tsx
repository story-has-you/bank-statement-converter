"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { usePublicAccount } from "@/components/account/public-account-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { readBillingResponse } from "@/lib/billing/response";
import { startStatusPolling, type PollState } from "@/lib/billing/status-polling";

import type { PaymentProviderId } from "@/lib/billing/provider";

type CancelSubscriptionButtonProps = { provider: PaymentProviderId; subscriptionId: string; periodEnd: string | null };
type CancellationState = "idle" | "submitting" | "syncing" | "delayed" | "checking" | "confirmed";

function hasCancelledSubscription(value: unknown, provider: PaymentProviderId, subscriptionId: string): boolean {
  if (typeof value !== "object" || value === null || !("subscriptions" in value) || !Array.isArray(value.subscriptions)) {
    return false;
  }
  return value.subscriptions.some(
    (record: unknown) =>
      typeof record === "object" &&
      record !== null &&
      "provider" in record &&
      record.provider === provider &&
      "subscriptionId" in record &&
      record.subscriptionId === subscriptionId &&
      "status" in record &&
      record.status === "CANCELLED",
  );
}

export function CancelSubscriptionButton(props: CancelSubscriptionButtonProps) {
  const { user } = usePublicAccount();
  return <CancelSubscriptionControl key={JSON.stringify([user?.id, props.provider, props.subscriptionId])} {...props} />;
}

function CancelSubscriptionControl({ provider, subscriptionId, periodEnd }: CancelSubscriptionButtonProps) {
  const t = useTranslations("Account.cancel");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const { refresh: refreshAccount } = usePublicAccount();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CancellationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const date =
    periodEnd && Number.isFinite(Date.parse(periodEnd))
      ? format.dateTime(new Date(periodEnd), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })
      : null;

  const polling = state === "syncing" || state === "checking";
  const handleState = useEffectEvent((next: PollState) => {
    if (next.kind === "pending") {
      return;
    }
    if (next.kind === "done") {
      setState("confirmed");
      void refreshAccount();
      router.refresh();
      return;
    }
    setState("delayed");
  });
  useEffect(() => {
    if (!polling) {
      return;
    }
    return startStatusPolling({
      initialDelayMs: retry === 0 ? 2_000 : 0,
      async read(signal) {
        const response = await fetch("/api/account", { headers: { "x-app-locale": locale }, cache: "no-store", signal });
        if (response.ok) {
          const snapshot: unknown = await response.json();
          if (hasCancelledSubscription(snapshot, provider, subscriptionId)) {
            return { kind: "done" };
          }
        }
        return { kind: "pending" };
      },
      onState(next) {
        handleState(next);
      },
    });
  }, [polling, provider, subscriptionId, locale, retry]);

  async function cancel() {
    if (state !== "idle") {
      return;
    }
    setError(null);
    setState("submitting");
    try {
      const response = await fetch("/api/billing/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-locale": locale },
        body: JSON.stringify({ provider, subscriptionId }),
      });
      const payload = readBillingResponse(await response.json());
      if (!mounted.current) {
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? t("failed"));
        setState("idle");
        return;
      }
      if (payload.status !== "CANCELLATION_PENDING" && payload.status !== "CANCELLED") {
        throw new Error(t("failed"));
      }
      setOpen(false);
      if (payload.status === "CANCELLED") {
        setState("confirmed");
        void refreshAccount();
        router.refresh();
      } else {
        setState("syncing");
      }
    } catch {
      if (!mounted.current) {
        return;
      }
      setError(t("failed"));
      setState("idle");
    }
  }

  function checkStatus(): void {
    setError(null);
    setState("checking");
    setRetry((value) => value + 1);
  }

  return (
    <div className="grid justify-items-end gap-2">
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (state !== "submitting") {
            setOpen(value);
          }
        }}
      >
        <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={state !== "idle"} />}>
          {t(state === "submitting" ? "submitting" : "button")}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title")}</AlertDialogTitle>
            <AlertDialogDescription>{date ? t("description", { date }) : t("descriptionWithoutDate")}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={state === "submitting"}>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={state !== "idle"} onClick={cancel}>
              {t(state === "submitting" ? "submitting" : "confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state !== "idle" && state !== "submitting" && (
        <p role="status" className="text-xs text-muted-foreground">
          {t(state)}
        </p>
      )}
      {(state === "delayed" || state === "checking") && (
        <Button variant="ghost" size="sm" disabled={state === "checking"} onClick={checkStatus}>
          {t(state === "checking" ? "checking" : "check")}
        </Button>
      )}
      {error && !open && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
