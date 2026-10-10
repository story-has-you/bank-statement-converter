import { routing } from "@/i18n/routing";
import { getAgentDocumentResponse } from "@/lib/geo/documents";
import { agentDocuments } from "@/lib/geo/links";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => agentDocuments.map((document) => ({ locale, document })));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; document: string }> },
): Promise<Response> {
  const { locale, document } = await params;
  return getAgentDocumentResponse(locale, document);
}
