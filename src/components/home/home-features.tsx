import { FileCheck2Icon, LandmarkIcon, ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function HomeFeatures() {
  const t = useTranslations("HomeFeatures");

  return (
    <section id="features" className="border-t border-border bg-muted/35" aria-labelledby="features-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-14">
        <h2 id="features-title" className="text-xl font-semibold sm:text-2xl">
          {t("title")}
        </h2>
        <div className="mt-7 grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <ShieldCheckIcon className="size-6 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">{t("securityTitle")}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{t("securityDescription")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <LandmarkIcon className="size-6 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">{t("banksTitle")}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{t("banksDescription")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <FileCheck2Icon className="size-6 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">{t("accuracyTitle")}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{t("accuracyDescription")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
