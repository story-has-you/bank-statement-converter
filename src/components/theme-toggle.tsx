"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon, SunMoonIcon } from "lucide-react";
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
  const { theme, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="切换外观" />}>
            <SunMoonIcon data-icon="inline-start" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <SunIcon />
                浅色
                {theme === "light" && <CheckIcon className="ml-auto" aria-hidden="true" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <MoonIcon />
                深色
                {theme === "dark" && <CheckIcon className="ml-auto" aria-hidden="true" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <MonitorIcon />
                跟随系统
                {theme === "system" && <CheckIcon className="ml-auto" aria-hidden="true" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipTrigger>
      <TooltipContent>切换外观</TooltipContent>
    </Tooltip>
  );
}
