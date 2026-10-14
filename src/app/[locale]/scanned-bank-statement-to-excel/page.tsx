import { ConversionLandingPage } from "@/components/landing/conversion-landing-page";
import { getLandingMetadata } from "@/lib/seo/landing-metadata";

type ScannedPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ScannedPageProps) {
  const { locale } = await params;
  return getLandingMetadata(locale, "scanned");
}

export default function Page() {
  return <ConversionLandingPage id="scanned" />;
}
