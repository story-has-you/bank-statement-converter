import { getFormatter, getTranslations } from "next-intl/server";

import { PublicPlanState } from "@/components/billing/public-plan-state";
import { ClientMessages } from "@/components/shared/client-messages";
import { subscriptionConfig } from "@/config/plans";
import { Link } from "@/i18n/navigation";
import { membershipTiers } from "@/lib/billing/config";
import { getCheckoutConfigs } from "@/lib/billing/providers";
import { usageQuotaConfig } from "@/lib/usage/config";

export async function UsageTiers() {
  const t = await getTranslations("UsageTiers");
  const format = await getFormatter();
  const checkouts = getCheckoutConfigs();

  return (
    <ClientMessages namespaces={["UsageTiers", "Billing"]}>
      <section id="plans" className="border-t border-border" aria-labelledby="plans-title">
        <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-14">
          <div className="flex flex-col gap-2">
            <h2 id="plans-title" className="text-xl font-semibold sm:text-2xl">
              {t("title")}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{t("description")}</p>
          </div>

          <div className="mt-7 grid border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-border">
            <div className="flex items-center justify-between gap-4 py-4 sm:pr-6">
              <p className="text-sm font-medium text-muted-foreground">{t("anonymous")}</p>
              <p className="text-2xl font-semibold">
                {t("anonymousAmount", { pages: usageQuotaConfig.anonymous.pages })}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border py-4 sm:border-t-0 sm:pl-6">
              <p className="text-sm font-medium text-muted-foreground">{t("signedIn")}</p>
              <p className="text-2xl font-semibold">
                {t("signedInAmount", { pages: usageQuotaConfig.authenticated.pages })}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span>
              </p>
            </div>
          </div>

          <PublicPlanState />

          <p className="mt-8 text-sm leading-6 text-muted-foreground">
            {t.rich("renewalNote", {
              account: (chunks) => (
                <Link href="/account" className="text-primary underline underline-offset-4">
                  {chunks}
                </Link>
              ),
              terms: (chunks) => (
                <Link href="/terms#subscription" className="text-primary underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {membershipTiers.map((tier) => (
              <article key={tier} className="flex flex-col gap-4 rounded-xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h3 className="text-base font-semibold">{t(`plans.${tier}.name`)}</h3>
                    <p className="text-3xl font-semibold">
                      {format.number(subscriptionConfig[tier].monthlyPrice, { style: "currency", currency: "USD" })}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{t(`plans.${tier}.description`)}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {subscriptionConfig[tier].qwenFallback ? t("aiParsing") : t("textParsing")}
                </p>
                <p className="mt-auto text-sm font-medium">{t("planQuota", { pages: usageQuotaConfig.subscriptions[tier].pages })}</p>
                <PublicPlanState checkouts={checkouts} tier={tier} />
              </article>
            ))}
          </div>
        </div>
      </section>
    </ClientMessages>
  );
}
