import { useTranslations } from "next-intl";

export function HomeIntro() {
  const t = useTranslations("HomeIntro");

  return (
    <div className="mb-9 flex flex-col gap-3 sm:mb-6">
      <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        {t("description")}
      </p>
    </div>
  );
}
