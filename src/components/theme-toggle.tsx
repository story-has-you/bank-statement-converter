"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon, SunMoonIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const t = useTranslations("ThemeToggle");
  const { theme, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t("label")} />}>
            <SunMoonIcon data-icon="inline-start" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <SunIcon />
                {t("light")}
                {theme === "light" && <CheckIcon className="ml-auto" aria-hidden="true" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <MoonIcon />
                {t("dark")}
                {theme === "dark" && <CheckIcon className="ml-auto" aria-hidden="true" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <MonitorIcon />
                {t("system")}
                {theme === "system" && <CheckIcon className="ml-auto" aria-hidden="true" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipTrigger>
      <TooltipContent>{t("label")}</TooltipContent>
    </Tooltip>
  );
}
