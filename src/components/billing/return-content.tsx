import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/server";
import { ClientMessages } from "@/components/shared/client-messages";
import { BillingReturnStatus } from "./return-status";

export async function BillingReturnContent() {
  const t = await getTranslations("BillingReturn");
  const { userId } = await getSession();
  return (
    <section className="mx-auto grid w-full max-w-xl gap-5 px-5 py-12" aria-labelledby="billing-return-title">
      <h1 id="billing-return-title" className="text-2xl font-semibold">
        {t("title")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <Suspense fallback={<p role="status">{t("pending")}</p>}>
        <ClientMessages namespaces={["BillingReturn"]}>
          <BillingReturnStatus signedIn={Boolean(userId)} />
        </ClientMessages>
      </Suspense>
    </section>
  );
}
