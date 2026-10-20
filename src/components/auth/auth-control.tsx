"use client";

import { LogInIcon, LogOutIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useConversion } from "@/components/conversion/conversion-provider";
import { useState } from "react";

import { usePublicAccount } from "@/components/account/public-account-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/browser";

export function AuthControl() {
  const { status, configured, user } = usePublicAccount();
  const email = user?.email ?? null;
  const imageUrl = user?.avatarUrl ?? null;
  const signedIn = Boolean(user);
  const t = useTranslations("AuthControl");
  const locale = useLocale();
  const router = useRouter();
  const conversion = useConversion();
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
        options: { redirectTo: `${window.location.origin}/api/auth/callback?locale=${encodeURIComponent(locale)}` },
      });
      if (authError) {
        throw authError;
      }
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
        conversion.reset();
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
            <Link
              href="/account"
              aria-label={t("myAccount")}
              title={email ?? t("account")}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <UserAvatar imageUrl={imageUrl} alt={t("avatar")} />
            </Link>
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="outline" size="icon" disabled={pending} onClick={signOut} aria-label={t("signOut")} />}
              >
                <LogOutIcon />
              </TooltipTrigger>
              <TooltipContent>{t("signOut")}</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={pending || !configured || status === "loading"}
            onClick={signIn}
            title={!configured ? t("unavailable") : undefined}
          >
            <LogInIcon data-icon="inline-start" />
            {t("signInWithGoogle")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
