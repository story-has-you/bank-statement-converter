import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function AuthErrorContent() {
  const t = useTranslations("AuthError");

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <Link className={buttonVariants()} href="/">
        {t("backHome")}
      </Link>
    </div>
  );
}
