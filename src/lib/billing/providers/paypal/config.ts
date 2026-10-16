import "server-only";

import { membershipTiers } from "@/lib/billing/config";
import type { MembershipTier } from "@/lib/billing/types";

const planKeys: Record<MembershipTier, string> = {
  standard: "PAYPAL_PLAN_ID_STANDARD",
  professional: "PAYPAL_PLAN_ID_PROFESSIONAL",
  enterprise: "PAYPAL_PLAN_ID_ENTERPRISE",
};

export function getPayPalEnvironment(): "sandbox" | "live" {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
}

export function getPayPalPlanId(tier: MembershipTier): string | null {
  return process.env[planKeys[tier]]?.trim() || null;
}

export function getPayPalTier(planId: string): MembershipTier | null {
  return membershipTiers.find((tier) => getPayPalPlanId(tier) === planId) ?? null;
}

export function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  const plans = membershipTiers.map(getPayPalPlanId);
  if (!clientId || !clientSecret || !webhookId || plans.some((id) => !id) || new Set(plans).size !== membershipTiers.length) {
    return null;
  }
  const environment = getPayPalEnvironment();
  return {
    clientId,
    clientSecret,
    webhookId,
    environment,
    apiUrl: environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com",
  };
}
