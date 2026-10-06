import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConversionResult } from "@/components/conversion-result";
import { HomeFooter } from "@/components/home-footer";
import { HomeHeader } from "@/components/home-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ConversionResult.metadata");
  return { title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}

export default function ConversionResultPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HomeHeader />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8">
        <ConversionResult />
      </main>
      <HomeFooter />
    </div>
  );
}
