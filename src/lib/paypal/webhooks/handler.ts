import { NextResponse } from "next/server";

import { getPayPalApiTranslations } from "@/lib/paypal/messages";
import { verifyPayPalWebhookSignature } from "@/lib/paypal/server";
import { getString, isWebhookPayload } from "@/lib/paypal/webhooks/shared";
import { webhookStrategies } from "@/lib/paypal/webhooks/strategies";

/** 统一解析、验签并分发事件，保持 Webhook 的响应和重试契约。 */
export async function handlePayPalWebhook(request: Request): Promise<Response> {
  const t = await getPayPalApiTranslations(request);
  let payload: unknown;

  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: t("webhookInvalidRequest") }, { status: 400 });
  }

  if (!isWebhookPayload(payload)) {
    return NextResponse.json({ error: t("webhookInvalidRequest") }, { status: 400 });
  }

  try {
    if (!(await verifyPayPalWebhookSignature(request.headers, payload))) {
      console.warn("PayPal webhook signature verification failed");
      return NextResponse.json({ error: t("webhookSignatureFailed") }, { status: 400 });
    }

    const eventType = getString(payload.event_type);
    const strategy = eventType ? webhookStrategies.get(eventType) : undefined;
    if (!strategy) return NextResponse.json({ received: true });

    const result = await strategy(payload);
    console.info("PayPal webhook event processed", {
      eventId: getString(payload.id),
      eventType,
      result,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process PayPal webhook", {
      eventId: getString(payload.id),
      eventType: getString(payload.event_type),
      reason: error instanceof Error ? error.message : "Webhook processing failed",
    });
    return NextResponse.json({ error: t("webhookProcessingFailed") }, { status: 502 });
  }
}
