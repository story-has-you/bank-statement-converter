import { notFound } from "next/navigation";

import { ConversionLandingPage } from "@/components/landing/conversion-landing-page";
import { findBankPage } from "@/config/conversion-pages";

export async function BankStatementPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const page = findBankPage(slug);
  if (!page) notFound();
  return <ConversionLandingPage id={page.id} />;
}
