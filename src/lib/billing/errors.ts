import type messages from "../../../messages/zh-CN.json";
import type { PendingCheckout } from "./provider";

export type BillingErrorCode = keyof typeof messages.Billing.api;

export class BillingError extends Error {
  constructor(
    public readonly code: BillingErrorCode,
    public readonly status: number,
    public readonly pendingCheckout?: PendingCheckout,
  ) {
    super(code);
    this.name = "BillingError";
  }
}
