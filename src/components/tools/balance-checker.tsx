"use client";

import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseBalanceAmount } from "@/lib/balance-checker";

const fields = ["opening", "incoming", "outgoing", "closing"] as const;

export function BalanceChecker() {
  const t = useTranslations("BalanceChecker");
  const locale = useLocale();
  const format = useFormatter();
  const [values, setValues] = useState({ opening: "", incoming: "", outgoing: "", closing: "" });
  const cents = fields.map((field) => parseBalanceAmount(values[field], field === "opening" || field === "closing"));
  const [opening, incoming, outgoing, closing] = cents;
  const complete = opening !== null && incoming !== null && outgoing !== null && closing !== null;
  const expected = complete ? opening + incoming - outgoing : null;
  const difference = expected !== null && closing !== null ? expected - closing : null;
  const number = (value: number) => format.number(value / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <section className="grid gap-6 rounded-xl border border-border p-5 sm:p-6" aria-label={t("title")}>
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {fields.map((field, i) => {
          const invalid = values[field].trim() !== "" && cents[i] === null;
          return (
            <Field key={field} data-invalid={invalid}>
              <FieldLabel htmlFor={`balance-${field}`}>{t(field)}</FieldLabel>
              <Input
                id={`balance-${field}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={values[field]}
                aria-invalid={invalid}
                aria-describedby={`balance-${field}-hint`}
                onChange={(event) => setValues({ ...values, [field]: event.target.value })}
              />
              <FieldDescription id={`balance-${field}-hint`}>{t(invalid ? "invalid" : "format")}</FieldDescription>
            </Field>
          );
        })}
      </FieldGroup>
      <div role="status" aria-live="polite" className="grid gap-2 text-sm leading-7">
        {expected !== null && difference !== null ? (
          <>
            <p>{t("expected", { amount: number(expected) })}</p>
            <p>{t("difference", { amount: number(difference) })}</p>
            <p className="font-medium">{t(difference === 0 ? "balanced" : "unbalanced")}</p>
          </>
        ) : (
          <p className="text-muted-foreground">{t("incomplete")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" onClick={() => setValues({ opening: "", incoming: "", outgoing: "", closing: "" })}>
          {t("reset")}
        </Button>
        <a className="text-sm underline underline-offset-4" href={`/templates/balance-checker-${locale}.xlsx`} download>
          {t("download")}
        </a>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">{t("privacy")}</p>
    </section>
  );
}
