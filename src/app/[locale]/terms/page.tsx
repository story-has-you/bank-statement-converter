import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPageLayout } from "@/components/legal-page-layout";
import { TermsContent } from "@/components/terms-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Terms.metadata");
  return { title: t("title"), description: t("description") };
}

export default function TermsPage() {
  return (
    <LegalPageLayout>
      <TermsContent />
    </LegalPageLayout>
  );
}
