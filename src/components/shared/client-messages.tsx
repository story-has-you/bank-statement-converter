import type { ReactNode } from "react";
import { NextIntlClientProvider, type AppConfig } from "next-intl";
import { getMessages } from "next-intl/server";

type ClientMessagesProps = {
  namespaces: readonly (keyof AppConfig["Messages"])[];
  children: ReactNode;
};

export async function ClientMessages({ namespaces, children }: ClientMessagesProps) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={Object.fromEntries(namespaces.map((namespace) => [namespace, messages[namespace]]))}>
      {children}
    </NextIntlClientProvider>
  );
}
