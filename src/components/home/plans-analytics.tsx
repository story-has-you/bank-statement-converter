"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { funnelAnalyticsEnabled } from "@/config/analytics";
import { analyticsPage, trackEvent } from "@/lib/analytics";

export function PlansAnalytics() {
  const locale = useLocale();
  const pathname = usePathname();
  const viewed = useRef<string | null>(null);

  useEffect(() => {
    const visit = `${locale}:${pathname}`;
    if (!funnelAnalyticsEnabled || viewed.current === visit || typeof IntersectionObserver === "undefined") return;
    const plans = document.getElementById("plans");
    if (!plans) return;
    const observer = new IntersectionObserver((entries) => {
      if (viewed.current === visit || !entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.01)) return;
      viewed.current = visit;
      observer.disconnect();
      trackEvent("view_plans", analyticsPage(locale, pathname));
    }, { threshold: 0.01 });
    observer.observe(plans);
    return () => observer.disconnect();
  }, [locale, pathname]);

  return null;
}
