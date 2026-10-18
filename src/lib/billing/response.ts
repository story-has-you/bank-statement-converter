import type { CheckoutResult } from "@/lib/billing/provider";

/** Reads only displayable error/status fields from an untrusted JSON response. */
export function readBillingResponse(value: unknown): { error?: string; status?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return {
    error: "error" in value && typeof value.error === "string" ? value.error : undefined,
    status: "status" in value && typeof value.status === "string" ? value.status : undefined,
  };
}

export function isCheckoutResult(value: unknown): value is CheckoutResult {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("provider" in value)) {
    return false;
  }
  return (
    (value.provider === "creem" || value.provider === "paypal" || value.provider === "waffo") &&
    "checkoutId" in value &&
    typeof value.checkoutId === "string" &&
    value.checkoutId.length > 0 &&
    "checkoutUrl" in value &&
    typeof value.checkoutUrl === "string" &&
    value.checkoutUrl.length > 0
  );
}
