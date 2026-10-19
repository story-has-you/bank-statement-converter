import { getTranslations } from "next-intl/server";

import { AuthControl } from "@/components/auth/auth-control";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Link } from "@/i18n/navigation";

export async function HomeHeader() {
  const t = await getTranslations("HomeHeader");

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 py-2 sm:px-8">
        <Link className="flex min-w-0 items-center gap-2.5" href="/">
          <BrandLogo className="size-9 shrink-0" />
          <span className="truncate text-sm font-semibold">{t("brand")}</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex" aria-label={t("navigation")}>
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

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <AuthControl />
        </div>
      </div>
    </header>
  );
}
