import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BillingReturnStatus } from "./return-status";

export async function BillingReturnContent() {
  const t = await getTranslations("BillingReturn");
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  return <section className="mx-auto grid w-full max-w-xl gap-5 px-5 py-12" aria-labelledby="billing-return-title">
    <h1 id="billing-return-title" className="text-2xl font-semibold">{t("title")}</h1>
    <p className="text-sm text-muted-foreground">{t("description")}</p>
    <Suspense fallback={<p role="status">{t("pending")}</p>}><BillingReturnStatus signedIn={Boolean(user)} /></Suspense>
  </section>;
}
