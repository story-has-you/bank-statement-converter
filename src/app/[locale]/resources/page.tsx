import { ResourcesPage } from "@/components/resources/resources-page";
import { getResourcesMetadata } from "@/lib/seo/resources-metadata";

type ResourcesPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ResourcesPageProps) {
  const { locale } = await params;
  return getResourcesMetadata(locale);
}

export default function Page() {
  return <ResourcesPage />;
}
