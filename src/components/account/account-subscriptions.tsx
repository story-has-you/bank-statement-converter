import { getFormatter, getTranslations } from "next-intl/server";

import { CancelSubscriptionButton } from "@/components/billing/cancel-subscription-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AccountSubscription } from "@/lib/account/types";

export async function AccountSubscriptions({ subscriptions }: { subscriptions: AccountSubscription[] | null }) {
  const t = await getTranslations("Account");
  const plans = await getTranslations("UsageTiers");
  const format = await getFormatter();
  function date(value: string | null): string {
    if (!value || !Number.isFinite(Date.parse(value))) return t("notAvailable");
    return format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("subscriptions.title")}</CardTitle>
        <CardDescription>{t("subscriptions.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {subscriptions === null ? (
          <Alert><AlertDescription>{t("subscriptions.unavailable")}</AlertDescription></Alert>
        ) : subscriptions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("subscriptions.empty")}</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t("subscriptions.plan")}</TableHead>
              <TableHead>{t("subscriptions.amount")}</TableHead>
              <TableHead>{t("subscriptions.status")}</TableHead>
              <TableHead>{t("subscriptions.created")}</TableHead>
              <TableHead>{t("subscriptions.period")}</TableHead>
              <TableHead className="text-right">{t("subscriptions.actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{subscriptions.map((subscription) => (
              <TableRow key={`${subscription.provider}:${subscription.subscriptionId}`}>
                <TableCell className="font-medium">{plans(`plans.${subscription.tier}.name`)}</TableCell>
                <TableCell className="tabular-nums">
                  {subscription.amount !== null && subscription.currencyCode
                    ? format.number(subscription.amount, { style: "currency", currency: subscription.currencyCode })
                    : t("notAvailable")}
                </TableCell>
                <TableCell><Badge variant="secondary">{t(`statuses.${subscription.status}`)}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{date(subscription.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div>{date(subscription.periodStart)}</div>
                  <div>{date(subscription.periodEnd)}</div>
                </TableCell>
                <TableCell className="max-w-64 text-right whitespace-normal">
                  {(subscription.status === "ACTIVE" || (subscription.provider === "creem" && subscription.status === "PAYMENT_FAILED")) && <CancelSubscriptionButton
                    provider={subscription.provider} subscriptionId={subscription.subscriptionId} periodEnd={subscription.periodEnd} />}
                  {subscription.status === "CANCELLED" && subscription.entitlementActive && (
                    <p className="text-xs text-muted-foreground">{t("subscriptions.availableUntil", { date: date(subscription.periodEnd) })}</p>
                  )}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
