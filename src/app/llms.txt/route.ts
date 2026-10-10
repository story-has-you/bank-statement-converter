import { routing } from "@/i18n/routing";
import { getAgentDocumentResponse } from "@/lib/geo/documents";

export const dynamic = "force-static";

export function GET(): Promise<Response> {
  return getAgentDocumentResponse(routing.defaultLocale, "llms.txt");
}
