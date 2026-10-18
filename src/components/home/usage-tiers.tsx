import { getFormatter, getTranslations } from "next-intl/server";

import { SubscriptionOptions } from "@/components/billing/subscription-options";
import { subscriptionConfig } from "@/config/plans";
import { findEntitledBillingSubscription, findOpenBillingSubscription } from "@/lib/billing/server";
import { membershipTiers } from "@/lib/billing/config";
import { getCheckoutConfigs } from "@/lib/billing/providers";
import { getRenderAuthContext } from "@/lib/supabase/server";
import { usageQuotaConfig } from "@/lib/usage/config";

export async function UsageTiers() {
  const t = await getTranslations("UsageTiers");
  const format = await getFormatter();
  const { user } = await getRenderAuthContext();
  const [activeSubscription, openSubscription] = user
    ? await Promise.all([findEntitledBillingSubscription(user.id), findOpenBillingSubscription(user.id)])
    : [null, null];
  const hasSubscription = Boolean(activeSubscription || openSubscription);
  const cancelledPeriodEnd = activeSubscription?.status === "CANCELLED" ? activeSubscription.current_period_end : null;
  const checkouts = getCheckoutConfigs();

  return (
    <section id="plans" className="border-t border-border" aria-labelledby="plans-title">
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-2">
          <h2 id="plans-title" className="text-xl font-semibold sm:text-2xl">
            {t("title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{t("description")}</p>
        </div>

        <div className="mt-7 grid border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-border">
          <div className="flex flex-col gap-3 py-5 sm:pr-6">
            <p className="text-sm font-medium text-muted-foreground">{t("anonymous")}</p>
            <p className="text-3xl font-semibold">
              {t("anonymousAmount", { pages: usageQuotaConfig.anonymous.pages })}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span>
            </p>
            <p className="text-sm text-muted-foreground">{t("anonymousDescription", { pages: usageQuotaConfig.anonymous.pages })}</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-border py-5 sm:border-t-0 sm:pl-6">
            <p className="text-sm font-medium text-muted-foreground">{t("signedIn")}</p>
            <p className="text-3xl font-semibold">
              {t("signedInAmount", { pages: usageQuotaConfig.authenticated.pages })}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span>
            </p>
            <p className="text-sm text-muted-foreground">{t("signedInDescription", { pages: usageQuotaConfig.authenticated.pages })}</p>
          </div>
        </div>

        {cancelledPeriodEnd && (
          <p role="status" className="mt-8 text-sm leading-6 text-muted-foreground">
            {t("cancelledPeriodActive", {
              date: format.dateTime(new Date(cancelledPeriodEnd), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }),
            })}
          </p>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
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
                {activeSubscription?.tier === tier && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{t("current")}</span>
                )}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{t(`plans.${tier}.description`)}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {subscriptionConfig[tier].qwenFallback ? t("aiParsing") : t("textParsing")}
              </p>
              <p className="mt-auto text-sm font-medium">{t("planQuota", { pages: usageQuotaConfig.subscriptions[tier].pages })}</p>
              {!hasSubscription && <SubscriptionOptions checkouts={checkouts} signedIn={Boolean(user)} tier={tier} />}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
