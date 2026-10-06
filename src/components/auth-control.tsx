"use client";

import { LogInIcon, LogOutIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/browser";

type AuthControlProps = {
  configured: boolean;
  email: string | null;
  signedIn: boolean;
};

export function AuthControl({ configured, email, signedIn }: AuthControlProps) {
  const t = useTranslations("AuthControl");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError(t("unavailable"));
      return;
    }

    setPending(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?locale=${encodeURIComponent(locale)}`,
        },
      });
      if (authError) throw authError;
    } catch {
      setError(t("signInFailed"));
      setPending(false);
    }
  }

  async function signOut() {
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError(t("unavailable"));
      return;
    }

    setPending(true);
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) {
        setError(t("signOutFailed"));
      } else {
        router.refresh();
      }
    } catch {
      setError(t("signOutFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div className="flex min-w-0 items-center gap-2">
        {signedIn ? (
          <>
            <span className="max-w-20 truncate text-xs text-muted-foreground sm:max-w-28 lg:max-w-40" title={email ?? t("account")}>
              {email ?? t("account")}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon" disabled={pending} onClick={signOut} aria-label={t("signOut")} />
                }
              >
                <LogOutIcon />
              </TooltipTrigger>
              <TooltipContent>{t("signOut")}</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Button variant="outline" disabled={pending || !configured} onClick={signIn} title={!configured ? t("unavailable") : undefined}>
            <LogInIcon data-icon="inline-start" />
            {t("signInWithGoogle")}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="max-w-48 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}
