import { useTranslations } from "next-intl";

export function HomeFeatures() {
  const t = useTranslations("HomeFeatures");

  return (
    <section id="features" className="border-t border-border bg-muted/50" aria-labelledby="features-title">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <h2 id="features-title" className="font-heading text-3xl font-medium leading-snug sm:text-4xl">
          {t("title")}
        </h2>
        <div className="divide-y divide-border border-y border-border">
          <div className="py-5">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-5">
              <h3 className="text-sm font-semibold">{t("securityTitle")}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{t("securityDescription")}</p>
            </div>
          </div>
          <div className="py-5">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-5">
              <h3 className="text-sm font-semibold">{t("banksTitle")}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{t("banksDescription")}</p>
            </div>
          </div>
          <div className="py-5">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-5">
              <h3 className="text-sm font-semibold">{t("accuracyTitle")}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{t("accuracyDescription")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
