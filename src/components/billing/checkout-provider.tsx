"use client";

import type { ReactNode } from "react";
import type { CheckoutConfig } from "@/lib/billing/provider";
import { PayPalScriptProviderWrapper } from "./providers/paypal/script-provider";

const checkoutProviders = { paypal: PayPalScriptProviderWrapper };

export function CheckoutProvider({ checkout, children }: { checkout: CheckoutConfig; children: ReactNode }) {
  const Provider = checkoutProviders[checkout.provider];
  return <Provider clientId={checkout.settings.clientId} environment={checkout.settings.environment}>{children}</Provider>;
}
