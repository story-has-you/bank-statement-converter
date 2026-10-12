import "server-only";

import {
  Client,
  Environment,
  SubscriptionsController,
  type Subscription,
} from "@paypal/paypal-server-sdk";

import {
  getPayPalApiBaseUrl,
  getPayPalServerConfig,
  getPayPalWebhookId,
} from "./config";

function createPayPalClient(): Client {
  const config = getPayPalServerConfig();
  if (!config) {
    throw new Error("PayPal server configuration is incomplete");
  }

  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
    environment:
      process.env.PAYPAL_ENVIRONMENT === "production"
        ? Environment.Production
        : Environment.Sandbox,
    timeout: 10_000,
  });
}

export async function getPayPalSubscription(subscriptionId: string): Promise<Subscription> {
  const controller = new SubscriptionsController(createPayPalClient());
  const response = await controller.getSubscription({
    id: subscriptionId,
    fields: "last_failed_payment,plan",
  });

  if (!response.result) {
    throw new Error("PayPal returned an empty subscription response");
  }

  return response.result;
}

export async function createPayPalSubscription(
  planId: string,
  customId: string,
): Promise<Subscription> {
  const controller = new SubscriptionsController(createPayPalClient());
  const response = await controller.createSubscription({
    prefer: "return=representation",
    body: {
      planId,
      customId,
    },
  });

  if (!response.result?.id) {
    throw new Error("PayPal did not return a subscription ID");
  }

  return response.result;
}

export async function cancelPayPalSubscription(subscriptionId: string): Promise<void> {
  const controller = new SubscriptionsController(createPayPalClient());
  const response = await controller.cancelSubscription({
    id: subscriptionId,
    body: { reason: "Subscriber requested cancellation from account page" },
  });
  if (response.statusCode !== 204) throw new Error("PayPal did not confirm subscription cancellation");
}

async function getPayPalAccessToken(): Promise<string> {
  const config = getPayPalServerConfig();
  if (!config) {
    throw new Error("PayPal server configuration is incomplete");
  }

  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PayPal OAuth request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("access_token" in payload) ||
    typeof payload.access_token !== "string"
  ) {
    throw new Error("PayPal OAuth response did not contain an access token");
  }

  return payload.access_token;
}

export async function verifyPayPalWebhookSignature(
  headers: Headers,
  webhookEvent: unknown,
): Promise<boolean> {
  const webhookId = getPayPalWebhookId();
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (
    !webhookId ||
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  const accessToken = await getPayPalAccessToken();
  const response = await fetch(
    `${getPayPalApiBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return false;
  }

  const payload: unknown = await response.json();
  return (
    typeof payload === "object" &&
    payload !== null &&
    "verification_status" in payload &&
    payload.verification_status === "SUCCESS"
  );
}
