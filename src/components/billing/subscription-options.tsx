"use client";

import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { subscriptionConfig } from "@/config/plans";
import { Link } from "@/i18n/navigation";
import type { CheckoutConfig } from "@/lib/billing/provider";
import type { MembershipTier } from "@/lib/billing/types";
import { SubscriptionButton } from "./subscription-button";

export function SubscriptionOptions({
  checkouts,
  tier,
  signedIn,
}: {
  checkouts: CheckoutConfig[];
  tier: MembershipTier;
  signedIn: boolean;
}) {
  const t = useTranslations("Billing");
  const format = useFormatter();
  const consentId = useId();
  const disclosureId = useId();
  const [renewalConsent, setRenewalConsent] = useState(false);
  if (!signedIn) {
    return <p className="text-sm text-muted-foreground">{t("signInRequired")}</p>;
  }
  if (checkouts.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-3">
      <div id={disclosureId} className="grid gap-2 text-sm leading-6 text-muted-foreground">
        <p>
          {t("renewalDisclosure", {
            amount: format.number(subscriptionConfig[tier].monthlyPrice, { style: "currency", currency: "USD", currencyDisplay: "code" }),
          })}
        </p>
        <p>
          {t.rich("renewalCancellation", {
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
      </div>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox id={consentId} checked={renewalConsent} onCheckedChange={setRenewalConsent} aria-describedby={disclosureId} />
          <FieldLabel htmlFor={consentId}>{t("renewalConsent")}</FieldLabel>
        </Field>
      </FieldGroup>
      <div className="grid auto-cols-fr grid-flow-col items-start gap-3">
        {checkouts.map((checkout) => (
          <SubscriptionButton key={checkout.provider} checkout={checkout} tier={tier} renewalConsent={renewalConsent} />
        ))}
      </div>
    </div>
  );
}
