import "server-only";

import { conversionLimits } from "@/config/conversion";

import { subscriptionConfig } from "@/config/plans";
import type { MembershipTier } from "@/lib/billing/types";
import { isParseResponse, type ParseResponse } from "@/lib/conversion-types";
import { ConversionError } from "@/lib/conversion-errors";

export { MAX_RESPONSE_BYTES } from "@/config/conversion";

export function canUseQwen(tier: MembershipTier | undefined): boolean {
  return tier !== undefined && subscriptionConfig[tier].aiParsing;
}

export function requireUsableResult(value: unknown): ParseResponse {
  if (!isParseResponse(value) || value.pageCount < 1) {
    throw new ConversionError("INVALID_PARSER_RESPONSE");
  }
  if (value.pageCount > conversionLimits.pages) {
    throw new ConversionError("TOO_MANY_PAGES", 413);
  }
  if (value.summary.status === "failed" || value.summary.validRowCount + value.summary.warningRowCount === 0) {
    throw new ConversionError("NO_VERIFIABLE_TRANSACTIONS", 422);
  }
  return value;
}
