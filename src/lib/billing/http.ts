import "server-only";

import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { resolveLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";

import { isMembershipTier } from "./config";
import { BillingError } from "./errors";
import { getPaymentProvider } from "./providers";
import { cancelSubscription, confirmSubscription, requireConfiguredProvider } from "./subscriptions";
import { createSubscription } from "./checkouts";
import { applyBillingEvent } from "./events";

type SubscriptionAction = "create" | "activate" | "cancel";

function getApiTranslations(request: Request) {
  return getTranslations({ locale: resolveLocale(request.headers.get("x-app-locale")), namespace: "Billing.api" });
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const originHost = origin && URL.canParse(origin) ? new URL(origin).host : null;
  // 与 Next.js 的代理来源检查一致；devtunnel 可能把 Origin 改写为内部 Host。
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (!originHost || (originHost !== host && originHost !== forwardedHost)) {
    throw new BillingError("cancelInvalidOrigin", 403);
  }
}

/** 订阅路由共用认证、输入和响应处理。 */
export async function handleSubscriptionRequest(request: Request, action: SubscriptionAction): Promise<Response> {
  const t = await getApiTranslations(request);
  const headers = { "Cache-Control": "no-store" };
  const errorResponse = (code: Parameters<typeof t>[0], status: number) => NextResponse.json({ error: t(code), code }, { status, headers });
  try {
    requireSameOrigin(request);
    const supabase = await createClient();
    if (!supabase) {
      throw new BillingError("loginUnavailable", 503);
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new BillingError("loginRequired", 401);
    }
    if (action === "create" && !data.user.email) {
      throw new BillingError("emailMissing", 422);
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new BillingError("invalidRequest", 400);
    }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new BillingError("invalidRequest", 400);
    }
    const input = payload as Record<string, unknown>;
    const provider = getPaymentProvider(input.provider);
    if (action === "create") {
      if (!isMembershipTier(input.tier)) {
        throw new BillingError("invalidTier", 400);
      }
      if (input.renewalConsent !== true) {
        throw new BillingError("renewalConsentRequired", 400);
      }
      const locale = resolveLocale(request.headers.get("x-app-locale"));
      const prefix = locale === "en" ? "" : `/${locale}`;
      const returnUrl = new URL(`${prefix}/billing/return`, siteConfig.url);
      returnUrl.searchParams.set("tier", input.tier);
      const result = await createSubscription(provider, input.tier, { id: data.user.id, email: data.user.email! }, returnUrl.href);
      return NextResponse.json(result, { headers });
    }
    if (action === "activate") {
      if (!isMembershipTier(input.tier) || typeof input.checkoutId !== "string") {
        throw new BillingError("invalidRequest", 400);
      }
      requireConfiguredProvider(provider, input.tier);
      const checkout = await provider.resolveCheckout(input.checkoutId, input.tier, data.user.id);
      if (checkout.status === "closed") {
        throw new BillingError("checkoutClosed", 409);
      }
      if (checkout.status !== "completed") {
        return NextResponse.json({ status: "PENDING" }, { status: 202, headers: { "Cache-Control": "no-store" } });
      }
      const subscriptionId = checkout.subscriptionId;
      const remote = await provider.getSubscription(subscriptionId);
      if (remote.userId !== data.user.id) {
        throw new BillingError("subscriptionBelongsToAnotherAccount", 409);
      }
      if (remote.tier !== input.tier || remote.planId !== provider.getPlanId(input.tier)) {
        throw new BillingError("planMismatch", 409);
      }
      const result = await confirmSubscription(provider, subscriptionId, input.tier, data.user.id);
      return NextResponse.json(result, { status: result.status === "PENDING" ? 202 : 200, headers: { "Cache-Control": "no-store" } });
    }
    if (!provider.isSubscriptionId(input.subscriptionId)) {
      throw new BillingError("invalidRequest", 400);
    }
    return NextResponse.json(await cancelSubscription(provider, input.subscriptionId, data.user.id), { headers });
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: t(error.code), code: error.code, ...(error.pendingCheckout ? { pendingCheckout: error.pendingCheckout } : {}) },
        { status: error.status, headers },
      );
    }
    console.error("Billing subscription request failed", { action });
    const codes = { create: "createFailed", activate: "activationFailed", cancel: "cancelFailed" } as const;
    return errorResponse(codes[action], 502);
  }
}

export async function handleBillingWebhook(request: Request, providerId: unknown): Promise<Response> {
  const t = await getApiTranslations(request);
  try {
    const provider = getPaymentProvider(providerId);
    const event = await provider.parseWebhook(request.headers, await request.text());
    if (event) {
      const result = await applyBillingEvent(event);
      console.info("Billing webhook event processed", { provider: provider.id, eventId: event.id, type: event.type, result });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof BillingError && ["invalidProvider", "webhookInvalidRequest", "webhookSignatureFailed"].includes(error.code)) {
      return NextResponse.json({ error: t(error.code) }, { status: error.status });
    }
    let reason = error instanceof BillingError ? error.code : "WEBHOOK_PROCESSING_FAILED";
    if (error instanceof Error && error.message === "Creem payment evidence is invalid") {
      reason = "CREEM_PAYMENT_EVIDENCE_INVALID";
    }
    console.error("Failed to process billing webhook", { provider: providerId, reason });
    return NextResponse.json({ error: t("webhookProcessingFailed") }, { status: 502 });
  }
}
