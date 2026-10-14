import { ConversionLandingPage } from "@/components/landing/conversion-landing-page";
import { getLandingMetadata } from "@/lib/seo/landing-metadata";

type QuickbooksPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: QuickbooksPageProps) {
  const { locale } = await params;
  return getLandingMetadata(locale, "quickbooks");
}

export default function Page() {
  return <ConversionLandingPage id="quickbooks" />;
}
