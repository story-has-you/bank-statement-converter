import { getFormatter, getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AccountQuota as Quota } from "@/lib/account/types";

export async function AccountQuota({ quota }: { quota: Quota | null }) {
  const t = await getTranslations("Account.quota");
  const format = await getFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {quota ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xl font-semibold tabular-nums">{t("remaining", { remaining: quota.remainingPages, total: quota.limitPages })}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{t("percentage", { percent: format.number(quota.remainingPercent, { maximumFractionDigits: 2 }) })}</p>
            </div>
            <Progress
              value={quota.remainingPercent}
              aria-label={t("progressLabel")}
              aria-valuetext={t("remaining", { remaining: quota.remainingPages, total: quota.limitPages })}
              className="**:data-[slot=progress-track]:h-2"
            />
            <p className="text-sm text-muted-foreground">
              {t(quota.period === "day" ? "dayEnds" : "monthEnds", { date: format.dateTime(new Date(quota.periodEnd), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) })}
            </p>
          </>
        ) : (
          <Alert>
            <AlertDescription>{t("unavailable")}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
