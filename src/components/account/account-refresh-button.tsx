"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function AccountRefreshButton() {
  const t = useTranslations("Account");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RefreshCwIcon data-icon="inline-start" className={pending ? "animate-spin motion-reduce:animate-none" : undefined} />
      {t(pending ? "refreshing" : "refresh")}
    </Button>
  );
}
