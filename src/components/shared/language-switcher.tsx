"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getLocalizedPath } from "@/i18n/metadata";
import { usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();

  function switchLocale(nextLocale: AppLocale): void {
    if (nextLocale !== locale) {
      // 语言位于根布局参数中，完整导航让文档和脚本一起重新加载。
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 跨语言需要完整文档导航。
      window.location.assign(`${getLocalizedPath(nextLocale, pathname)}${window.location.search}${window.location.hash}`);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t("label")} />}>
            <LanguagesIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
            <DropdownMenuGroup>
              {routing.locales.map((option) => (
                <DropdownMenuItem key={option} onClick={() => switchLocale(option)}>
                  {t(option)}
                  {locale === option && <span className="ml-auto text-xs">{t("current")}</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipTrigger>
      <TooltipContent>{t("label")}</TooltipContent>
    </Tooltip>
  );
}

LanguageSwitcher.displayName = "LanguageSwitcher";
