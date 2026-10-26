"use client";

import { sendGAEvent } from "@next/third-parties/google";

import { funnelAnalyticsEnabled, trialPendingCookie } from "@/config/analytics";
import type { MembershipTier } from "@/lib/billing/types";
import type { PaymentProviderId } from "@/lib/billing/provider";
import type { SummaryStatus } from "@/lib/conversion-types";

type FunnelEvents = {
  file_upload: { locale: string };
  conversion_success: { locale: string; result_status: SummaryStatus; page_count: number };
  start_trial: { locale: string; method: "google" };
  purchase: {
    locale: string;
    payment_provider: PaymentProviderId;
    plan_tier: MembershipTier;
    transaction_id: string;
    items: { item_id: MembershipTier; quantity: 1 }[];
  };
};

const sentEvents = new Set<string>();

export function trackEvent<Name extends keyof FunnelEvents>(name: Name, params: FunnelEvents[Name], onceKey?: string): void {
  if (!funnelAnalyticsEnabled) {
    return;
  }
  const storageKey = onceKey && `bank-statement-converter:analytics:v1:${onceKey}`;
  if (storageKey) {
    if (sentEvents.has(storageKey)) {
      return;
    }
    try {
      if (localStorage.getItem(storageKey)) {
        return;
      }
    } catch {
      // shortcut: blocked browser storage limits deduplication to this tab until storage is available.
    }
  }
  try {
    // Login can complete before the deferred Google script initializes the queue.
    window.dataLayer ??= [];
    sendGAEvent("event", name, params);
  } catch {
    return; // Analytics must not interrupt conversion, sign-in, or payment confirmation.
  }
  if (storageKey) {
    sentEvents.add(storageKey);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // The in-memory marker still prevents repeats in this tab.
    }
  }
}

export function trackTrialStart(userId: string, locale: string, hasPaidEntitlement: boolean): void {
  if (!funnelAnalyticsEnabled) {
    return;
  }
  try {
    if (!document.cookie.split(";").some((cookie) => cookie.trim() === `${trialPendingCookie}=true`)) {
      return;
    }
    document.cookie = `${trialPendingCookie}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    return;
  }
  if (!hasPaidEntitlement) {
    trackEvent("start_trial", { locale, method: "google" }, `trial:${userId}`);
  }
}
