import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthErrorContent } from "@/components/auth-error-content";
import { LegalPageLayout } from "@/components/legal-page-layout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AuthError.metadata");
  return { title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}

export default function AuthErrorPage() {
  return (
    <LegalPageLayout>
      <AuthErrorContent />
    </LegalPageLayout>
  );
}
