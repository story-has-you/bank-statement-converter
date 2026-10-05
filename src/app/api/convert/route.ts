import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isParseResponse } from "@/lib/conversion-types";
import {
  consumeConversionQuota,
  createAnonymousId,
  getActiveSubscription,
  getQuotaContext,
  getUsageRecord,
  hashAnonymousId,
  isUsageRecordCurrent,
  type UsageActor,
  type QuotaContext,
  UsageUnavailableError,
} from "@/lib/usage/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorPayload = {
  code: string;
  message: string;
  period?: "day" | "month";
  usedPages?: number;
  remainingPages?: number;
  limitPages?: number;
};

const ANONYMOUS_COOKIE = "bank-statement-converter-anonymous";

function errorResponse(
  code: string,
  message: string,
  status: number,
  quota?: Partial<Pick<ErrorPayload, "period" | "usedPages" | "remainingPages" | "limitPages">>,
): NextResponse<ErrorPayload> {
  return NextResponse.json({ code, message, ...quota }, { status });
}

function setAnonymousCookie(response: NextResponse, value: string | null): NextResponse {
  if (value) {
    response.cookies.set({
      name: ANONYMOUS_COOKIE,
      value,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

function isCurrentUsageAtLimit(
  record: Awaited<ReturnType<typeof getUsageRecord>>,
  context: QuotaContext,
): boolean {
  return Boolean(record && isUsageRecordCurrent(record, context) && record.used_pages >= context.limitPages);
}

async function getRequestActor(): Promise<{ actor: UsageActor; cookieValue: string | null }> {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (user) {
    return {
      actor: { type: "user", key: user.id, email: user.email ?? null },
      cookieValue: null,
    };
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(ANONYMOUS_COOKIE)?.value;
  const cookieValue = existingCookie ?? createAnonymousId();
  return {
    actor: { type: "anonymous", key: hashAnonymousId(cookieValue), email: null },
    cookieValue: existingCookie ? null : cookieValue,
  };
}

async function readErrorPayload(response: Response): Promise<ErrorPayload> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "code" in payload &&
      "message" in payload &&
      typeof payload.code === "string" &&
      typeof payload.message === "string"
    ) {
      return { code: payload.code, message: payload.message };
    }
  } catch {
    // The parser may return a non-JSON error when it is unavailable.
  }

  return { code: "PARSER_UNAVAILABLE", message: "解析服务暂时不可用" };
}

export async function POST(request: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("INVALID_REQUEST", "无法读取上传文件", 400);
  }

  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return errorResponse("INVALID_FILE", "请选择一个 PDF 文件", 400);
  }

  if (!entry.name.toLowerCase().endsWith(".pdf") || entry.size === 0) {
    return errorResponse("INVALID_FILE", "请选择有效的 PDF 文件", 400);
  }

  let actor: UsageActor;
  let anonymousCookie: string | null;
  let context: QuotaContext;
  try {
    const requestActor = await getRequestActor();
    actor = requestActor.actor;
    anonymousCookie = requestActor.cookieValue;
    const subscription = actor.type === "user" ? await getActiveSubscription(actor.key) : null;
    context = getQuotaContext(actor, subscription);
    const currentUsage = await getUsageRecord(actor);
    if (isCurrentUsageAtLimit(currentUsage, context)) {
      return setAnonymousCookie(
        errorResponse("QUOTA_EXCEEDED", "QUOTA_EXCEEDED", 429, {
          period: context.window.period,
          usedPages: currentUsage?.used_pages,
          remainingPages: 0,
          limitPages: context.limitPages,
        }),
        anonymousCookie,
      );
    }
  } catch (error) {
    if (!(error instanceof UsageUnavailableError)) {
      console.error("Failed to resolve conversion quota", error);
    }
    return errorResponse("QUOTA_UNAVAILABLE", "QUOTA_UNAVAILABLE", 503);
  }

  const upstreamData = new FormData();
  upstreamData.append(
    "file",
    new Blob([await entry.arrayBuffer()], { type: entry.type || "application/pdf" }),
    entry.name,
  );

  const parserBaseUrl = (process.env.PARSER_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const parserUrl = `${parserBaseUrl}/parse`;
  let parserResponse: Response;
  try {
    parserResponse = await fetch(parserUrl, {
      method: "POST",
      body: upstreamData,
      cache: "no-store",
    });
  } catch {
    return setAnonymousCookie(
      errorResponse("PARSER_UNAVAILABLE", "解析服务暂时不可用，请确认 Python 服务已启动", 502),
      anonymousCookie,
    );
  }

  if (!parserResponse.ok) {
    const payload = await readErrorPayload(parserResponse);
    return setAnonymousCookie(
      errorResponse(payload.code, payload.message, parserResponse.status),
      anonymousCookie,
    );
  }

  try {
    const payload: unknown = await parserResponse.json();
    if (!isParseResponse(payload) || !Number.isInteger(payload.pageCount) || payload.pageCount <= 0) {
      return setAnonymousCookie(
        errorResponse("PARSER_UNAVAILABLE", "解析服务返回了无效结果", 502),
        anonymousCookie,
      );
    }

    let quotaResult;
    try {
      quotaResult = await consumeConversionQuota(context, payload.pageCount);
    } catch (error) {
      console.error("Failed to record conversion usage", error);
      return setAnonymousCookie(
        errorResponse("QUOTA_UNAVAILABLE", "QUOTA_UNAVAILABLE", 503),
        anonymousCookie,
      );
    }

    if (!quotaResult.allowed) {
      return setAnonymousCookie(
        errorResponse("QUOTA_EXCEEDED", "QUOTA_EXCEEDED", 429, {
          period: quotaResult.period,
          usedPages: quotaResult.usedPages,
          remainingPages: quotaResult.remainingPages,
          limitPages: quotaResult.limitPages,
        }),
        anonymousCookie,
      );
    }

    return setAnonymousCookie(NextResponse.json(payload, { status: 200 }), anonymousCookie);
  } catch {
    return setAnonymousCookie(
      errorResponse("PARSER_UNAVAILABLE", "解析服务返回了无效结果", 502),
      anonymousCookie,
    );
  }
}
