import { ConversionLandingPage } from "@/components/landing/conversion-landing-page";
import { getLandingMetadata } from "@/lib/seo/landing-metadata";

type PdfPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PdfPageProps) {
  const { locale } = await params;
  return getLandingMetadata(locale, "pdf");
}

export default function Page() {
  return <ConversionLandingPage id="pdf" />;
}
