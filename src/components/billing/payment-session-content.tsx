"use client";

import type { ReactNode } from "react";
import type { PaymentSessionState } from "@/components/billing/payment-session";

/** Keeps the render callback separate from providers' event-only session locks. */
export function PaymentSessionContent({ session, children }: { session: PaymentSessionState; children: (session: PaymentSessionState) => ReactNode }) {
  return children(session);
}
