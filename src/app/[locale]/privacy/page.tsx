import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalPageLayout } from "@/components/legal-page-layout";
import { PrivacyContent } from "@/components/privacy-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy.metadata");
  return { title: t("title"), description: t("description") };
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout>
      <PrivacyContent />
    </LegalPageLayout>
  );
}
