"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useConversionActions } from "@/components/conversion/conversion-provider";
import { useState } from "react";

import { usePublicAccount } from "@/components/account/public-account-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Link } from "@/i18n/navigation";

export function AuthControl() {
  const { user, configured } = usePublicAccount();
  const { signOut: clerkSignOut } = useClerk();
  const email = user?.email ?? null;
  const imageUrl = user?.avatarUrl ?? null;
  const signedIn = Boolean(user);
  const t = useTranslations("AuthControl");
  const router = useRouter();
  const { reset } = useConversionActions();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setError(null);
    setPending(true);
    try {
      await clerkSignOut();
      reset();
      router.refresh();
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
        ) : configured ? (
          <Button variant="outline" render={<Link href="/sign-in" />}>{t("signIn")}</Button>
        ) : null}
      </div>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
