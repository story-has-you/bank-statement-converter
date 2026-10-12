import "server-only";

import type { MembershipTier } from "@/lib/billing/types";

import { membershipTiers } from "@/lib/billing/config";

const planEnvironmentKeys: Record<MembershipTier, string> = {
  standard: "PAYPAL_PLAN_ID_STANDARD",
  professional: "PAYPAL_PLAN_ID_PROFESSIONAL",
  enterprise: "PAYPAL_PLAN_ID_ENTERPRISE",
};

export type PayPalPlan = {
  tier: MembershipTier;
  planId: string;
};

export type PayPalEnvironment = "sandbox" | "production";

export function getPayPalPlanId(tier: MembershipTier): string | null {
  const value = process.env[planEnvironmentKeys[tier]];
  return value?.trim() || null;
}

export function getPayPalPlans(): PayPalPlan[] {
  return membershipTiers.flatMap((tier) => {
    const planId = getPayPalPlanId(tier);
    return planId ? [{ tier, planId }] : [];
  });
}

export function getPayPalClientId(): string | null {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() || null;
}

export function getPayPalServerConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret || getPayPalPlans().length !== membershipTiers.length) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getPayPalWebhookId(): string | null {
  return process.env.PAYPAL_WEBHOOK_ID?.trim() || null;
}

export function getPayPalApiBaseUrl(): string {
  return getPayPalEnvironment() === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function getPayPalEnvironment(): PayPalEnvironment {
  return process.env.PAYPAL_ENVIRONMENT === "production" ? "production" : "sandbox";
}
