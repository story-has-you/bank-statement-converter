import type messages from "../../../messages/zh-CN.json";

export type BillingErrorCode = keyof typeof messages.Billing.api;

export class BillingError extends Error {
  constructor(public readonly code: BillingErrorCode, public readonly status: number) {
    super(code);
    this.name = "BillingError";
  }
}
