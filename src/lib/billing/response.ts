import type { CheckoutResult, PendingCheckout } from "@/lib/billing/provider";
import { isMembershipTier } from "./config";

/** Reads only displayable error/status fields from an untrusted JSON response. */
export function readBillingResponse(value: unknown): { error?: string; status?: string; pendingCheckout?: PendingCheckout } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const pending = "pendingCheckout" in value ? value.pendingCheckout : null;
  let pendingCheckout: PendingCheckout | undefined;
  if (typeof pending === "object" && pending !== null && "provider" in pending && "tier" in pending) {
    if ((pending.provider === "creem" || pending.provider === "paypal" || pending.provider === "waffo") && isMembershipTier(pending.tier)) {
      pendingCheckout = { provider: pending.provider, tier: pending.tier };
    }
  }
  return {
    error: "error" in value && typeof value.error === "string" ? value.error : undefined,
    status: "status" in value && typeof value.status === "string" ? value.status : undefined,
    pendingCheckout,
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
