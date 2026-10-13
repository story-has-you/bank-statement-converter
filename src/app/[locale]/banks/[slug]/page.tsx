import { BankStatementPage } from "@/components/landing/bank-statement-page";
import { getBankLandingMetadata } from "@/lib/seo/landing-metadata";

type BankPageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: BankPageProps) {
  return getBankLandingMetadata(params);
}

export default function Page({ params }: BankPageProps) {
  return <BankStatementPage params={params} />;
}
