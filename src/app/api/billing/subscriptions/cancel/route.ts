import { handleSubscriptionRequest } from "@/lib/billing/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleSubscriptionRequest(request, "cancel");
}
