import "server-only";

import { BillingError } from "./errors";
import type { MembershipTier } from "./types";
import type { PaymentProvider, ProviderSubscription } from "./provider";
import {
  findBillingSubscriptionByProviderId, findEntitledBillingSubscription, findOpenBillingSubscription,
  updateBillingSubscriptionStatus, type BillingSubscription,
} from "./server";
import { getPaymentProvider } from "./providers";

export function requireConfiguredProvider(provider: PaymentProvider, tier?: MembershipTier): void {
  if (!provider.isConfigured() || (tier && !provider.getPlanId(tier))) {
    throw new BillingError("configurationMissing", 503);
  }
}

export function checkSubscriptionIdentity(existing: BillingSubscription, remote: ProviderSubscription): void {
  if (remote.subscriptionId !== existing.provider_subscription_id) throw new BillingError("subscriptionIdMismatch", 409);
  if (remote.userId !== existing.user_id) throw new BillingError("subscriptionBelongsToAnotherAccount", 409);
  if (remote.planId !== existing.provider_plan_id || remote.tier !== existing.tier) throw new BillingError("planMismatch", 409);
}

export async function createSubscription(provider: PaymentProvider, tier: MembershipTier, userId: string) {
  requireConfiguredProvider(provider, tier);
  const open = await findOpenBillingSubscription(userId);
  if (open) {
    if (open.status === "ACTIVE") throw new BillingError("existingActiveSubscription", 409);
    if (open.status === "SUSPENDED") throw new BillingError("existingSuspendedSubscription", 409);
    throw new BillingError("existingPendingSubscription", 409);
  }
  const entitled = await findEntitledBillingSubscription(userId);
  if (entitled?.status === "CANCELLED") throw new BillingError("cancelledPeriodActive", 409);
  return { provider: provider.id, subscriptionId: await provider.createSubscription(tier, userId) };
}

/** 前端确认只读取验签回调已写入的状态，不创建记录或授予权益。 */
export async function confirmSubscription(provider: PaymentProvider, subscriptionId: string, tier: MembershipTier, userId: string) {
  const planId = provider.getPlanId(tier);
  if (!planId) throw new BillingError("configurationMissing", 503);
  const existing = await findBillingSubscriptionByProviderId(provider.id, subscriptionId);
  if (existing && existing.user_id !== userId) throw new BillingError("subscriptionBelongsToAnotherAccount", 409);
  if (!existing) return { status: "PENDING" as const };
  if (existing.provider_plan_id !== planId || existing.tier !== tier) throw new BillingError("planMismatch", 400);
  if (existing.status !== "ACTIVE") {
    const errors = {
      PAYMENT_FAILED: "subscriptionPaymentFailed", CANCELLED: "subscriptionCancelled",
      EXPIRED: "subscriptionExpired", SUSPENDED: "subscriptionSuspended",
    } as const;
    if (Object.hasOwn(errors, existing.status)) {
      throw new BillingError(errors[existing.status as keyof typeof errors], 409);
    }
    return { status: "PENDING" as const };
  }
  const start = Date.parse(existing.current_period_start ?? "");
  const end = Date.parse(existing.current_period_end ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new BillingError("invalidBillingPeriod", 409);
  if (end <= Date.now()) throw new BillingError("billingPeriodEnded", 409);
  return { tier: existing.tier, status: existing.status, subscriptionId: existing.provider_subscription_id };
}

export async function cancelSubscription(provider: PaymentProvider, subscriptionId: string, userId: string) {
  requireConfiguredProvider(provider);
  const existing = await findBillingSubscriptionByProviderId(provider.id, subscriptionId);
  if (!existing || existing.user_id !== userId) throw new BillingError("cancelSubscriptionNotFound", 404);
  if (existing.status !== "ACTIVE" && existing.status !== "CANCELLED") throw new BillingError("cancelNotActive", 409);
  const remote = await provider.getSubscription(subscriptionId);
  checkSubscriptionIdentity(existing, remote);
  if (remote.status !== "CANCELLED") {
    if (existing.status !== "ACTIVE" || remote.status !== "ACTIVE") throw new BillingError("cancelNotActive", 409);
    await provider.cancelSubscription(subscriptionId);
  }
  return { status: existing.status === "CANCELLED" ? "CANCELLED" : "CANCELLATION_PENDING" };
}

/** 仅同步权威终态；远端失败或身份不一致时保留本地记录，不阻断登录。 */
export async function syncBillingSubscriptionStatus(userId: string): Promise<void> {
  try {
    const existing = await findOpenBillingSubscription(userId);
    if (!existing) return;
    const remote = await getPaymentProvider(existing.provider).getSubscription(existing.provider_subscription_id);
    checkSubscriptionIdentity(existing, remote);
    if (remote.status === "CANCELLED" || remote.status === "EXPIRED") {
      await updateBillingSubscriptionStatus(existing, remote.status);
    }
  } catch {
    console.error("Failed to synchronize billing subscription status");
  }
}
