import { updateBillingSubscriptionFromWebhook } from "@/lib/billing/server";
import {
  getObject,
  getWebhookEvent,
  type WebhookPayload,
  type WebhookResult,
} from "@/lib/paypal/webhooks/shared";
import { getVerifiedSubscription } from "@/lib/paypal/webhooks/subscription";

export async function handleSubscriptionCancelled(
  payload: WebhookPayload,
): Promise<WebhookResult> {
  const event = getWebhookEvent(payload);
  const resource = getObject(payload.resource);
  const verified = await getVerifiedSubscription(resource.id, event);
  if (!verified) return "ignored";

  const { existing, subscription } = verified;
  if (subscription.status !== "CANCELLED")
    throw new Error("PayPal cancellation is not confirmed yet");
  return updateBillingSubscriptionFromWebhook(existing, event, {
    status: "CANCELLED",
  });
}
