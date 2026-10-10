"use client";

import type { FC, ReactNode } from "react";
import { PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";

import type { PayPalEnvironment } from "@/lib/paypal/config";

type PayPalScriptProviderWrapperProps = {
  clientId: string | null;
  environment: PayPalEnvironment;
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
