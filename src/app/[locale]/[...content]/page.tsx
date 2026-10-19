import { EditorialPage } from "@/components/editorial/editorial-page";
import { editorialPages } from "@/config/editorial-pages";
import { getEditorialMetadata, type EditorialParams } from "@/lib/seo/editorial-content";

export function generateStaticParams() {
  return editorialPages.map((page) => ({ content: page.path.slice(1).split("/") }));
}

export async function generateMetadata({ params }: { params: EditorialParams }) {
  return getEditorialMetadata(params);
}

export default function Page({ params }: { params: EditorialParams }) {
  return <EditorialPage params={params} />;
}
