import { getTranslations } from "next-intl/server";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { usageQuotaConfig } from "@/lib/usage/config";

export const getHomeFaq = cache(async (locale: AppLocale) => {
  const t = await getTranslations({ locale, namespace: "HomeFaq" });
  const quota = usageQuotaConfig;
  return (["banks", "accuracy", "quota", "scans", "ai", "storage", "failure"] as const).map((id) => ({
    id,
    question: t(`${id}.question`),
    answer:
      id === "quota"
        ? t("quota.answer", {
            anonymousPages: quota.anonymous.pages,
            authenticatedPages: quota.authenticated.pages,
            standardPages: quota.subscriptions.standard.pages,
            professionalPages: quota.subscriptions.professional.pages,
            enterprisePages: quota.subscriptions.enterprise.pages,
          })
        : t(`${id}.answer`),
  }));
});
