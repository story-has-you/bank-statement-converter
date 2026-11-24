export function isClerkUserId(value: unknown): value is string {
  return typeof value === "string" && /^user_[A-Za-z0-9]+$/.test(value);
}
