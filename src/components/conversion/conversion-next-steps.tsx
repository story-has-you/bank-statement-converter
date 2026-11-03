import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function ConversionNextSteps() {
  const t = useTranslations("ConversionResult.nextSteps");

  return (
    <section className="grid gap-3" aria-labelledby="next-steps-title">
      <h2 id="next-steps-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">{t("description")}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link
            href="/guides/bank-statement-to-quickbooks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-4"
          >
            {t("quickbooks")}
          </Link>
        </li>
        <li>
          <Link
            href="/tools/bank-statement-balance-checker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-4"
          >
            {t("checker")}
          </Link>
        </li>
      </ul>
    </section>
  );
}
