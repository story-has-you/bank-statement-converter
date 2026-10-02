import { FileSpreadsheetIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HomeHeader() {
  const t = useTranslations("HomeHeader");

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <a className="flex min-w-0 items-center gap-2.5" href="#main">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileSpreadsheetIcon className="size-5" aria-hidden="true" />
          </span>
          <span className="truncate text-sm font-semibold">{t("brand")}</span>
        </a>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex" aria-label={t("navigation")}>
          <a className="transition-colors hover:text-foreground" href="#workspace">{t("convert")}</a>
          <a className="transition-colors hover:text-foreground" href="#features">{t("features")}</a>
          <a className="transition-colors hover:text-foreground" href="#plans">{t("plans")}</a>
          <a className="transition-colors hover:text-foreground" href="#faq">{t("faq")}</a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button variant="outline" disabled aria-label={t("loginUnavailable")}>
                {t("login")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("loginUnavailable")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
