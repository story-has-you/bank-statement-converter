import { useTranslations } from "next-intl";

import { usageQuotaConfig } from "@/lib/usage/config";

export function HomeIntro() {
  const t = useTranslations("HomeIntro");

  return (
    <div className="mb-6 flex flex-col gap-3">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{t("title")}</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        {t("description", { anonymousPages: usageQuotaConfig.anonymous.pages, authenticatedPages: usageQuotaConfig.authenticated.pages })}
      </p>
    </div>
  );
}
