import { getTranslations } from "next-intl/server";

import { ClerkForm } from "@/components/auth/clerk-form";

export async function generateMetadata() {
  const t = await getTranslations("AuthControl");
  return { title: t("signIn"), robots: { index: false } };
}

export default function SignInPage() {
  return <ClerkForm mode="sign-in" />;
}
