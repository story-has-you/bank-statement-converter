import "server-only";

import { membershipTiers } from "@/lib/billing/config";
import type { MembershipTier } from "@/lib/billing/types";

export function getWaffoEnvironment(): "test" | "prod" {
  return process.env.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test";
}

export function getWaffoProductId(tier: MembershipTier): string | null {
  return process.env[`WAFFO_PRODUCT_ID_${tier.toUpperCase()}`]?.trim() || null;
}

export function getWaffoTier(productId: string): MembershipTier | null {
  return membershipTiers.find((tier) => getWaffoProductId(tier) === productId) ?? null;
}

export function getWaffoConfig() {
  const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
  const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
  const storeId = process.env.WAFFO_STORE_ID?.trim();
  const returnBaseUrl = process.env.WAFFO_RETURN_BASE_URL?.trim();
  if (!merchantId || !privateKey || !storeId || !returnBaseUrl || !membershipTiers.every(getWaffoProductId)) {
    return null;
  }
  if (!URL.canParse(returnBaseUrl) || new URL(returnBaseUrl).protocol !== "https:") {
    return null;
  }
  return { merchantId, privateKey, storeId, returnBaseUrl, environment: getWaffoEnvironment() };
}
