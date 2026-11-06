import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { BillingError } from "./errors";
import type { MembershipTier } from "./types";
import { requireRecurringAmount } from "./usd";

export type CheckoutQuoteIdentity = {
  attemptId: string;
  userId: string;
  tier: MembershipTier;
  productId: string;
  storeId: string;
  environment: "test" | "prod";
};

type CheckoutQuote = CheckoutQuoteIdentity & { version: 1; currency: "USD"; amount: string; createdAt: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hasQuoteSigningSecret(): boolean {
  return Buffer.byteLength(process.env.BILLING_QUOTE_SIGNING_SECRET ?? "", "utf8") >= 32;
}

function signingSecret(): string {
  if (!hasQuoteSigningSecret()) throw new BillingError("configurationMissing", 503);
  return process.env.BILLING_QUOTE_SIGNING_SECRET!;
}

export function createCheckoutQuote(identity: CheckoutQuoteIdentity, amount: string): Record<string, string> {
  if (!uuid.test(identity.attemptId) || !uuid.test(identity.userId)) throw new Error("Checkout quote identity is invalid");
  const quote: CheckoutQuote = {
    version: 1, ...identity, currency: "USD", amount: requireRecurringAmount(amount), createdAt: new Date().toISOString(),
  };
  const billingQuote = JSON.stringify(quote);
  const billingQuoteSignature = createHmac("sha256", signingSecret()).update(billingQuote).digest("hex");
  return { billingQuote, billingQuoteSignature };
}

/** Null means an unsigned legacy order. Malformed or partially signed quotes must never use legacy evidence. */
export function readCheckoutQuote(metadata: string | null | undefined, expected: CheckoutQuoteIdentity): string | null {
  if (metadata == null) return null;
  if (typeof metadata !== "string" || metadata.length > 16384) throw new Error("Checkout metadata is invalid");
  const value: unknown = JSON.parse(metadata);
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Checkout metadata is invalid");
  if (!Object.hasOwn(value, "billingQuote") && !Object.hasOwn(value, "billingQuoteSignature")) return null;
  const { billingQuote, billingQuoteSignature } = value as Record<string, unknown>;
  if (typeof billingQuote !== "string" || billingQuote.length > 4096 || typeof billingQuoteSignature !== "string" || !/^[a-f0-9]{64}$/.test(billingQuoteSignature)) {
    throw new Error("Checkout quote signature is invalid");
  }
  const signature = createHmac("sha256", signingSecret()).update(billingQuote).digest();
  if (!timingSafeEqual(signature, Buffer.from(billingQuoteSignature, "hex"))) throw new Error("Checkout quote signature is invalid");
  const quote: unknown = JSON.parse(billingQuote);
  if (typeof quote !== "object" || quote === null || Array.isArray(quote)) throw new Error("Checkout quote is invalid");
  const data = quote as Record<string, unknown>;
  if (
    data.version !== 1 || data.currency !== "USD" ||
    !uuid.test(expected.attemptId) || !uuid.test(expected.userId) ||
    (Object.keys(expected) as (keyof CheckoutQuoteIdentity)[]).some((key) => data[key] !== expected[key]) ||
    typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt)) || Date.parse(data.createdAt) > Date.now() + 60_000 ||
    typeof data.amount !== "string" || requireRecurringAmount(data.amount) !== data.amount
  ) {
    throw new Error("Checkout quote identity or price is invalid");
  }
  // No expiry: provider sessions can be replaced and a valid paid webhook can arrive much later.
  return data.amount;
}
