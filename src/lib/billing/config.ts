import type { MembershipTier } from "./types";

export const membershipTiers = ["standard", "professional", "enterprise"] as const;

export function isMembershipTier(value: unknown): value is MembershipTier {
  return membershipTiers.some((tier) => tier === value);
}
