import { maxUploadBytes } from "@/config/conversion";
import { createConversionResponse, errorResponse } from "@/lib/conversion/response";
import { canUseQwen } from "@/lib/conversion/parser";
import { type QuotaContext, SubscriptionPeriodUnavailableError, UsageUnavailableError } from "@/lib/usage/server";
import { getRequestQuota, setAnonymousCookie } from "@/lib/usage/request";
import { getRequestLocale } from "@/i18n/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const locale = getRequestLocale(request);
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("INVALID_REQUEST", 400, locale);
  }

  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return errorResponse("MISSING_FILE", 400, locale);
  }

  if (
    !entry.name.toLowerCase().endsWith(".pdf") ||
    (entry.type && entry.type !== "application/pdf" && entry.type !== "application/octet-stream")
  ) {
    return errorResponse("INVALID_FILE_TYPE", 400, locale);
  }
  if (entry.size === 0) {
    return errorResponse("EMPTY_FILE", 400, locale);
  }
  if (entry.size > maxUploadBytes) {
    return errorResponse("FILE_TOO_LARGE", 413, locale);
  }

  const header = new Uint8Array(await entry.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== "%PDF-") {
    return errorResponse("INVALID_PDF", 400, locale);
  }

  let anonymousCookie: string | null;
  let context: QuotaContext;
  let allowQwen = false;
  let availablePages: number;
  try {
    const resolved = await getRequestQuota(request);
    context = resolved.context;
    anonymousCookie = resolved.anonymousCookie;
    allowQwen = canUseQwen(resolved.subscription?.tier);
    availablePages = resolved.quota.remainingPages;
    if (availablePages === 0) {
      return setAnonymousCookie(
        errorResponse("QUOTA_EXHAUSTED", 429, locale, {
          period: context.window.period,
          usedPages: resolved.usedPages,
          remainingPages: 0,
          limitPages: context.limitPages,
        }),
        anonymousCookie,
      );
    }
  } catch (error) {
    if (!(error instanceof UsageUnavailableError) && !(error instanceof SubscriptionPeriodUnavailableError)) {
      console.error("Failed to resolve conversion quota", { code: "QUOTA_UNAVAILABLE" });
    }
    const code = error instanceof SubscriptionPeriodUnavailableError ? "QUOTA_PERIOD_UNAVAILABLE" : "QUOTA_UNAVAILABLE";
    return errorResponse(code, 503, locale);
  }
  const response = await createConversionResponse(request, entry, context, allowQwen, locale, availablePages);
  return setAnonymousCookie(response, anonymousCookie);
}
