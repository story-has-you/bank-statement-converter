import { getTranslations } from "next-intl/server";

import { AuthControl } from "@/components/auth/auth-control";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Link } from "@/i18n/navigation";

export async function HomeHeader() {
  const t = await getTranslations("HomeHeader");

  return (
    <header className="px-5 sm:px-8">
      <div className="mx-auto flex min-h-20 w-full max-w-[76rem] flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-foreground py-4 sm:min-h-24">
        <Link className="flex min-w-0 items-center gap-2.5" href="/">
          <BrandLogo className="size-8 shrink-0" />
          <span className="truncate text-lg font-semibold tracking-tight sm:text-xl">{t("brand")}</span>
        </Link>

        <nav
          className="order-last flex w-full items-center gap-6 overflow-x-auto text-xs text-muted-foreground md:order-none md:w-auto md:gap-7 md:text-sm"
          aria-label={t("navigation")}
        >
          <Link className="transition-colors hover:text-foreground" href="/#workspace">
            {t("convert")}
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/#features">
            {t("features")}
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/#plans">
            {t("plans")}
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/#faq">
            {t("faq")}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-0 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <AuthControl />
        </div>
      </div>
    </header>
  );
}
