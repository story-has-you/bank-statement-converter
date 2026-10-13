export const subscriptionStatuses = ["APPROVAL_PENDING", "APPROVED", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED", "PAYMENT_FAILED"] as const;

export type MembershipTier = "standard" | "professional" | "enterprise";
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
