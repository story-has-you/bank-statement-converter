import "server-only";

import { Client, Environment, SubscriptionsController, type Subscription } from "@paypal/paypal-server-sdk";

import { getPayPalApiBaseUrl, getPayPalServerConfig, getPayPalWebhookId } from "./config";

function createPayPalClient(): Client {
  const config = getPayPalServerConfig();
  if (!config) {
    throw new Error("PayPal server configuration is incomplete");
  }

  return new Client({
    clientCredentialsAuthCredentials: { oAuthClientId: config.clientId, oAuthClientSecret: config.clientSecret },
    environment: process.env.PAYPAL_ENVIRONMENT === "production" ? Environment.Production : Environment.Sandbox,
    timeout: 10_000,
  });
}

export async function getPayPalSubscription(subscriptionId: string): Promise<Subscription> {
  const controller = new SubscriptionsController(createPayPalClient());
  const response = await controller.getSubscription({ id: subscriptionId, fields: "last_failed_payment,plan" });

  if (!response.result) {
    throw new Error("PayPal returned an empty subscription response");
  }

  return response.result;
}

export async function createPayPalSubscription(planId: string, customId: string): Promise<Subscription> {
  const controller = new SubscriptionsController(createPayPalClient());
  const response = await controller.createSubscription({ prefer: "return=representation", body: { planId, customId } });

  if (!response.result?.id) {
    throw new Error("PayPal did not return a subscription ID");
  }

  return response.result;
}

export async function cancelPayPalSubscription(subscriptionId: string): Promise<void> {
  const controller = new SubscriptionsController(createPayPalClient());
  const response = await controller.cancelSubscription({ id: subscriptionId, body: { reason: "Subscriber requested cancellation from account page" } });
  if (response.statusCode !== 204) throw new Error("PayPal did not confirm subscription cancellation");
}

async function getPayPalAccessToken(): Promise<string> {
  const config = getPayPalServerConfig();
  if (!config) {
    throw new Error("PayPal server configuration is incomplete");
  }

  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PayPal OAuth request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("access_token" in payload) || typeof payload.access_token !== "string") {
    throw new Error("PayPal OAuth response did not contain an access token");
  }

  return payload.access_token;
}

export async function verifyPayPalWebhookSignature(headers: Headers, rawWebhookEvent: string): Promise<boolean> {
  const webhookId = getPayPalWebhookId();
  if (!webhookId) {
    throw new Error("PayPal webhook configuration is incomplete");
  }
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.warn("PayPal webhook signature headers are incomplete");
    return false;
  }

  const accessToken = await getPayPalAccessToken();
  const verificationMetadata = JSON.stringify({
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
  });
  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    // 调用方已验证 JSON；保留原始事件，避免重新序列化改变签名所对应的内容。
    body: `${verificationMetadata.slice(0, -1)},"webhook_event":${rawWebhookEvent}}`,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PayPal webhook verification request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const verified = typeof payload === "object" && payload !== null && "verification_status" in payload && payload.verification_status === "SUCCESS";
  if (!verified) {
    console.warn("PayPal webhook signature verification failed; check the webhook ID for this listener and environment");
  }
  return verified;
}
