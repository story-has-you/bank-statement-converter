export type CheckoutAttribution = { clientId: string; sessionId: number };

export function readCheckoutAttribution(value: unknown): CheckoutAttribution | undefined {
  if (typeof value !== "object" || value === null || !("clientId" in value) || !("sessionId" in value)) return;
  const { clientId, sessionId } = value;
  if (
    typeof clientId === "string" && /^\d{1,20}\.\d{1,20}$/.test(clientId) &&
    typeof sessionId === "number" && Number.isSafeInteger(sessionId) && sessionId > 0
  ) {
    return { clientId, sessionId };
  }
}
