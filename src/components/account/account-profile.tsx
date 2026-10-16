import { getTranslations } from "next-intl/server";

import { AccountRefreshButton } from "@/components/account/account-refresh-button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { MembershipTier } from "@/lib/billing/types";

type AccountProfileProps = { email: string | null; imageUrl: string | null; tier: MembershipTier | null; available: boolean };

export async function AccountProfile({ email, imageUrl, tier, available }: AccountProfileProps) {
  const t = await getTranslations("Account");
  const plans = await getTranslations("UsageTiers");
  let planName = t("freePlan");
  if (!available) {
    planName = t("planUnavailable");
  } else if (tier) {
    planName = plans(`plans.${tier}.name`);
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4" aria-labelledby="account-title">
      <div className="flex min-w-0 items-center gap-4">
        <UserAvatar imageUrl={imageUrl} alt={t("avatar")} className="size-12" />
        <div className="grid min-w-0 gap-1">
          <h1 id="account-title" className="text-2xl font-semibold">
            {t("title")}
          </h1>
          <p className="break-all text-sm text-muted-foreground">{email ?? t("notAvailable")}</p>
          <Badge variant="secondary" className="mt-1 w-fit">
            {t("currentPlan", { plan: planName })}
          </Badge>
        </div>
      </div>
      <AccountRefreshButton />
    </section>
  );
}
