import type { MembershipTier } from "@/lib/billing/types";

export type PublicAccountSummary = {
  user: { email: string | null; avatarUrl: string | null } | null;
  activeTier: MembershipTier | null;
  hasSubscription: boolean;
  cancelledPeriodEnd: string | null;
};

export const anonymousAccountSummary: PublicAccountSummary = {
  user: null,
  activeTier: null,
  hasSubscription: false,
  cancelledPeriodEnd: null,
};
