"use client";

import type { FC, ReactNode } from "react";
import { PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";

import type { CheckoutConfig } from "@/lib/billing/provider";

type PayPalScriptProviderWrapperProps = {
  clientId: string | null;
  environment: Extract<CheckoutConfig, { provider: "paypal" }>["settings"]["environment"];
  children: ReactNode;
};

const PayPalScriptProviderWrapper: FC<PayPalScriptProviderWrapperProps> = ({
  clientId,
  environment,
  children,
}) => {
  return (
    <PayPalProvider
      clientId={clientId ?? undefined}
      components={["paypal-subscriptions"]}
      environment={environment}
      pageType="checkout"
    >
      {children}
    </PayPalProvider>
  );
};

PayPalScriptProviderWrapper.displayName = "PayPalScriptProviderWrapper";

export { PayPalScriptProviderWrapper };
