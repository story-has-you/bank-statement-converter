import "server-only";

import { membershipTiers } from "@/lib/billing/config";
import type { MembershipTier } from "@/lib/billing/types";

const productKeys: Record<MembershipTier, string> = { standard: "CREEM_PRODUCT_ID_STANDARD", professional: "CREEM_PRODUCT_ID_PROFESSIONAL", enterprise: "CREEM_PRODUCT_ID_ENTERPRISE" };

export function getCreemEnvironment(): "test" | "production" {
  return process.env.CREEM_ENVIRONMENT === "production" ? "production" : "test";
}

export function getCreemProductId(tier: MembershipTier): string | null {
  const value = process.env[productKeys[tier]]?.trim();
  if (!value || !/^prod_[A-Za-z0-9]+$/.test(value)) return null;
  return value;
}

export function getCreemTier(productId: string): MembershipTier | null {
  return membershipTiers.find((tier) => getCreemProductId(tier) === productId) ?? null;
}

export function getCreemWebhookSecret(): string | null {
  return process.env.CREEM_WEBHOOK_SECRET?.trim() || null;
}

export function getCreemConfig() {
  const apiKey = process.env.CREEM_API_KEY?.trim();
  const environment = getCreemEnvironment();
  if (!apiKey?.startsWith("creem_") || apiKey.startsWith("creem_test_") !== (environment === "test")) return null;
  const products = membershipTiers.map(getCreemProductId);
  if (products.some((id) => !id) || new Set(products).size !== membershipTiers.length || !getCreemWebhookSecret()) return null;
  return { apiKey, environment };
}
