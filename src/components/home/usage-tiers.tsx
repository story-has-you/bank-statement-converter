import { getTranslations } from "next-intl/server";

import { PayPalSubscriptionButton } from "@/components/billing/paypal-subscription-button";
import { PayPalScriptProviderWrapper } from "@/components/billing/paypal-script-provider";
import { siteConfig } from "@/config/site";
import { findEntitledBillingSubscription } from "@/lib/billing/server";
import {
  membershipTiers,
  getPayPalClientId,
  getPayPalEnvironment,
  getPayPalPlans,
} from "@/lib/paypal/config";
import { createClient } from "@/lib/supabase/server";
import { usageQuotaConfig } from "@/lib/usage/config";

export async function UsageTiers() {
  const t = await getTranslations("UsageTiers");
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const activeSubscription = user ? await findEntitledBillingSubscription(user.id) : null;
  const activeTierIndex = activeSubscription ? membershipTiers.indexOf(activeSubscription.tier) : -1;
  const planIds = new Map(getPayPalPlans().map((plan) => [plan.tier, plan.planId]));
  const clientId = getPayPalClientId();
  const environment = getPayPalEnvironment();
  const readRawTranslation = t.raw as (key: string) => unknown;
  const plans = readRawTranslation("plans") as Record<
    (typeof membershipTiers)[number],
    { name: string; description: string }
  >;

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
            <h3 className="text-sm font-medium text-muted-foreground">{t("anonymous")}</h3>
            <p className="text-3xl font-semibold">
              {t("anonymousAmount", { pages: usageQuotaConfig.anonymous.pages })}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("anonymousDescription", { pages: usageQuotaConfig.anonymous.pages })}
            </p>
          </div>
          <div className="flex flex-col gap-3 border-t border-border py-5 sm:border-t-0 sm:pl-6">
            <h3 className="text-sm font-medium text-muted-foreground">{t("signedIn")}</h3>
            <p className="text-3xl font-semibold">
              {t("signedInAmount", { pages: usageQuotaConfig.authenticated.pages })}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("signedInDescription", { pages: usageQuotaConfig.authenticated.pages })}
            </p>
          </div>
        </div>

        <PayPalScriptProviderWrapper clientId={clientId} environment={environment}>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {membershipTiers.map((tier) => {
              const plan = plans[tier];
              const tierIndex = membershipTiers.indexOf(tier);
              const isLowerTier = activeTierIndex > tierIndex;

              return (
                <article key={tier} className="flex flex-col gap-4 rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <h3 className="text-base font-semibold">{plan.name}</h3>
                      <p className="text-3xl font-semibold">
                        {siteConfig.subscriptionPrices[tier]}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
                      </p>
                    </div>
                    {activeSubscription?.tier === tier && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {t("current")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{plan.description}</p>
                  <p className="text-sm font-medium">
                    {t("planQuota", { pages: usageQuotaConfig.subscriptions[tier].pages })}
                  </p>
                  {!isLowerTier && (
                    <PayPalSubscriptionButton
                      clientId={clientId}
                      current={activeSubscription?.tier === tier && activeSubscription.status === "ACTIVE"}
                      planId={planIds.get(tier) ?? null}
                      signedIn={Boolean(user)}
                      tier={tier}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </PayPalScriptProviderWrapper>
      </div>
    </section>
  );
}
