"use client";

import type { ReactNode } from "react";
import type { CheckoutConfig } from "@/lib/billing/provider";
import { PayPalScriptProviderWrapper } from "./providers/paypal/script-provider";

export function CheckoutProvider({ checkouts, children }: { checkouts: CheckoutConfig[]; children: ReactNode }) {
  const paypal = checkouts.find((checkout) => checkout.provider === "paypal");
  if (!paypal || paypal.provider !== "paypal" || !paypal.available) return children;
  return (
    <PayPalScriptProviderWrapper clientId={paypal.settings.clientId} environment={paypal.settings.environment}>
      {children}
    </PayPalScriptProviderWrapper>
  );
}
