export type WebhookPayload = {
  id?: unknown;
  event_type?: unknown;
  create_time?: unknown;
  resource?: unknown;
};

export type WebhookEvent = { id: string; at: string };
export type WebhookResult = "applied" | "ignored";
export type WebhookStrategy = (payload: WebhookPayload) => Promise<WebhookResult>;

export function isWebhookPayload(value: unknown): value is WebhookPayload {
  return typeof value === "object" && value !== null;
}

export function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getWebhookEvent(payload: WebhookPayload): WebhookEvent {
  const id = getString(payload.id);
  const at = getString(payload.create_time);
  if (!id || !at || !Number.isFinite(Date.parse(at))) {
    throw new Error("PayPal webhook event identity is incomplete");
  }
  return { id, at };
}

export function requireString(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Subscription event is incomplete");
  return value;
}

export function requireTime(value: unknown): number {
  const time = Date.parse(requireString(value));
  if (!Number.isFinite(time)) throw new Error("Subscription event time is invalid");
  return time;
}
