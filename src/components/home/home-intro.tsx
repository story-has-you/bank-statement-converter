import { useTranslations } from "next-intl";

import { usageQuotaConfig } from "@/lib/usage/config";

export function HomeIntro() {
  const t = useTranslations("HomeIntro");

  return (
    <div className="flex flex-col gap-6 lg:py-2">
      <h1 className="max-w-3xl font-heading text-[clamp(2.25rem,4.2vw,3.75rem)] font-medium leading-[1.35] tracking-[-0.025em] text-balance">
        {t("title")}
      </h1>
      <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
        {t("description", { anonymousPages: usageQuotaConfig.anonymous.pages, authenticatedPages: usageQuotaConfig.authenticated.pages })}
      </p>
    </div>
  );
}
