import { SignIn, SignUp } from "@clerk/nextjs";
import { getLocale } from "next-intl/server";

import { resolveLocale } from "@/i18n/locale";
import { getLocalizedPath } from "@/i18n/metadata";

export async function ClerkForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const locale = resolveLocale(await getLocale());
  const signInUrl = getLocalizedPath(locale, "/sign-in");
  const signUpUrl = getLocalizedPath(locale, "/sign-up");
  const redirectUrl = `/api/auth/complete?locale=${locale}`;

  return (
    <main className="grid grow place-items-center px-4 py-12">
      {mode === "sign-in" ? (
        <SignIn path={signInUrl} signUpUrl={signUpUrl} forceRedirectUrl={redirectUrl} signUpForceRedirectUrl={redirectUrl} withSignUp />
      ) : (
        <SignUp path={signUpUrl} signInUrl={signInUrl} forceRedirectUrl={redirectUrl} signInForceRedirectUrl={redirectUrl} />
      )}
    </main>
  );
}
