"use client";

import { sendGAEvent } from "@next/third-parties/google";

import { analyticsMeasurementId, loginPendingCookie, trialPendingCookie } from "@/config/analytics";
import { publicPaths } from "@/config/public-pages";
import { readCheckoutAttribution, type CheckoutAttribution } from "@/lib/analytics-attribution";
import type { MembershipTier } from "@/lib/billing/types";
import type { PaymentProviderId } from "@/lib/billing/provider";
import type { ConversionMethod, SummaryStatus } from "@/lib/conversion-types";
import type { ExportFormat } from "@/lib/conversion-export";

type Page = { locale: string; entry_path?: string };
type Attempt = Page & { method: ConversionMethod };
type Export = Page & { format: ExportFormat | "xlsx" };
type Checkout = Page & { plan_tier: MembershipTier; payment_provider: PaymentProviderId };
type FunnelEvents = {
  file_selected: Page;
  file_preflight_success: Attempt & { page_count: number };
  upload_start: Attempt;
  upload_success: Attempt;
  conversion_start: Attempt;
  conversion_success: Attempt & { result_status: Exclude<SummaryStatus, "failed">; page_count: number };
  conversion_failed: Page & { method?: ConversionMethod; stage: "selection" | "preflight" | "conversion"; error_code: string };
  export_success: Export;
  export_failed: Export & { error_code: "EXPORT_FAILED" | "EXPORT_LOAD_FAILED" };
  view_plans: Page;
  login: Page & { method: "google" };
  sign_up: Page & { method: "google" };
  start_trial: Page & { method: "google" };
  begin_checkout: Checkout;
  checkout_failed: Checkout & { error_code: "CHECKOUT_CREATE_FAILED" | "CHECKOUT_REDIRECT_FAILED" };
};

const sentEvents = new Set<string>();
const exportStorageKey = "bank-statement-converter:analytics:exports";
let exported: { id: string; formats: string[] } | undefined;

export function analyticsPage(locale: string, pathname: string): Page {
  return { locale, entry_path: publicPaths.includes(pathname as (typeof publicPaths)[number]) ? pathname : undefined };
}

export function trackEvent<Name extends keyof FunnelEvents>(name: Name, params: FunnelEvents[Name]): boolean {
  if (!analyticsMeasurementId) return false;
  try {
    window.dataLayer ??= [];
    sendGAEvent("event", name, params);
    return true;
  } catch {
    return false;
  }
}

export function trackExportSuccess(params: Export, conversionId = "legacy"): void {
  if (!analyticsMeasurementId) return;
  let previous = exported;
  if (previous?.id !== conversionId) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(exportStorageKey) ?? "null");
      if (saved?.id === conversionId && Array.isArray(saved.formats)) previous = saved;
    } catch {
      // The in-memory marker still protects this tab until reload.
    }
  }
  if (previous?.id === conversionId && previous.formats.includes(params.format)) return;
  if (!trackEvent("export_success", params)) return;
  exported = { id: conversionId, formats: [...(previous?.id === conversionId ? previous.formats : []), params.format] };
  try {
    sessionStorage.setItem(exportStorageKey, JSON.stringify(exported));
  } catch {
    // Storage can be unavailable independently of downloads.
  }
}

function trackAccountOnce(name: "sign_up" | "start_trial", userId: string, locale: string): void {
  const storageKey = `bank-statement-converter:analytics:v1:${name === "start_trial" ? "trial" : name}:${userId}`;
  if (sentEvents.has(storageKey)) return;
  try {
    if (localStorage.getItem(storageKey)) return;
  } catch {
    // The account identifier is only used for browser-local deduplication.
  }
  if (!trackEvent(name, { locale, method: "google" })) return;
  sentEvents.add(storageKey);
  try {
    localStorage.setItem(storageKey, "1");
  } catch {
    // The in-memory marker still protects this tab until reload.
  }
}

function consumeAnalyticsCookie(name: string): string | undefined {
  try {
    const prefix = `${name}=`;
    const cookie = document.cookie.split(";").find((item) => item.trimStart().startsWith(prefix));
    if (!cookie) return;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    return cookie.trim().slice(prefix.length);
  } catch {
    // Analytics cannot interrupt sign-in.
  }
}

export function trackVerifiedLogin(userId: string, locale: string): void {
  if (!analyticsMeasurementId) return;
  const notification = consumeAnalyticsCookie(loginPendingCookie);
  if (notification !== "login" && notification !== "sign_up") return;
  trackEvent("login", { locale, method: "google" });
  if (notification === "sign_up") trackAccountOnce("sign_up", userId, locale);
}

export function trackTrialStart(userId: string, locale: string, hasPaidEntitlement: boolean): void {
  if (!analyticsMeasurementId) return;
  const pending = consumeAnalyticsCookie(trialPendingCookie);
  if (pending && !hasPaidEntitlement) trackAccountOnce("start_trial", userId, locale);
}

export async function getCheckoutAttribution(): Promise<CheckoutAttribution | undefined> {
  const measurementId = analyticsMeasurementId;
  if (!measurementId) return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag || (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] === true) return;
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(undefined), 250);
    let clientId: unknown;
    let sessionId: unknown;
    let received = 0;
    function finish(): void {
      received += 1;
      if (received !== 2) return;
      clearTimeout(timeout);
      const numericSessionId = typeof sessionId === "string" && /^\d+$/.test(sessionId) ? Number(sessionId) : sessionId;
      resolve(readCheckoutAttribution({ clientId, sessionId: numericSessionId }));
    }
    try {
      gtag("get", measurementId, "client_id", (value: unknown) => { clientId = value; finish(); });
      gtag("get", measurementId, "session_id", (value: unknown) => { sessionId = value; finish(); });
    } catch {
      clearTimeout(timeout);
      resolve(undefined);
    }
  });
}
