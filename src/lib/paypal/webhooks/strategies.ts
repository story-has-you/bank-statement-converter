import { handleSaleCompleted } from "@/lib/paypal/webhooks/sale-completed";
import type { WebhookStrategy } from "@/lib/paypal/webhooks/shared";
import { handleSubscriptionActivated } from "@/lib/paypal/webhooks/subscription-activated";
import { handleSubscriptionCancelled } from "@/lib/paypal/webhooks/subscription-cancelled";

export const webhookStrategies = new Map<string, WebhookStrategy>([
  ["BILLING.SUBSCRIPTION.ACTIVATED", handleSubscriptionActivated],
  ["BILLING.SUBSCRIPTION.CANCELLED", handleSubscriptionCancelled],
  ["PAYMENT.SALE.COMPLETED", handleSaleCompleted],
]);
