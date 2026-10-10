import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";

export async function AccountLoading() {
  const t = await getTranslations("Account");
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
