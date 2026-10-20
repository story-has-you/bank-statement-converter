"use client";

import { useTranslations } from "next-intl";

import { usePublicAccount } from "@/components/account/public-account-provider";
import { Button } from "@/components/ui/button";

export function PublicAccountStatus() {
  const { status, refresh } = usePublicAccount();
  const t = useTranslations("PublicAccount");

  if (status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("loading")}
      </p>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p role="alert" className="text-sm text-muted-foreground">
          {t("error")}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  return null;
}
