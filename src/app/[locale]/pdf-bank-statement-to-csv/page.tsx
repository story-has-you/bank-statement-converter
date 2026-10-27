import { ConversionLandingPage } from "@/components/landing/conversion-landing-page";
import { getLandingMetadata } from "@/lib/seo/landing-metadata";

type CsvPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CsvPageProps) {
  const { locale } = await params;
  return getLandingMetadata(locale, "csv");
}

export default function Page() {
  return <ConversionLandingPage id="csv" />;
}
