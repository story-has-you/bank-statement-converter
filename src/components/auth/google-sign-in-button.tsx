"use client";

import { LoaderCircleIcon, LogInIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { usePublicAccount } from "@/components/account/public-account-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

export function GoogleSignInButton({ returnTo }: { returnTo?: "plans" }) {
  const { status, configured } = usePublicAccount();
  const t = useTranslations("AuthControl");
  const locale = useLocale();
  const feedbackId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unavailable = status !== "loading" && !configured;
  const feedback = unavailable ? t("unavailable") : error;

  async function signIn() {
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError(t("unavailable"));
      return;
    }

    setPending(true);
    try {
      const callback = new URL("/api/auth/callback", window.location.origin);
      callback.searchParams.set("locale", locale);
      if (returnTo) {
        callback.searchParams.set("returnTo", returnTo);
      }
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (authError) {
        throw authError;
      }
    } catch {
      setError(t("signInFailed"));
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending || !configured || status === "loading"}
        aria-busy={pending}
        aria-describedby={feedback ? feedbackId : undefined}
        onClick={signIn}
      >
        {pending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <LogInIcon data-icon="inline-start" />}
        {pending ? t("signingIn") : t("signInWithGoogle")}
      </Button>
      {feedback && (
        <p id={feedbackId} role={error ? "alert" : "status"} className="max-w-xs text-sm text-muted-foreground">
          {feedback}
        </p>
      )}
    </div>
  );
}
