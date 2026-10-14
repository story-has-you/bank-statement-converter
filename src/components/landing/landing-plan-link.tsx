import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ConversionPageId } from "@/config/conversion-pages";

export async function LandingPlanLink({ id }: { id: ConversionPageId }) {
  if (id !== "scanned" && id !== "quickbooks") return null;
  const t = await getTranslations(`Landing.pages.${id}`);
  return (
    <div className="mb-6 flex flex-col items-start gap-2">
      <p className="text-sm leading-6 text-muted-foreground">{t("planNote")}</p>
      <Link href="#plans" className={buttonVariants({ variant: "outline" })}>
        {t("planCta")}
      </Link>
    </div>
  );
}
