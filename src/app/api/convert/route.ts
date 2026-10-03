import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorPayload = {
  code: string;
  message: string;
};

function errorResponse(code: string, message: string, status: number): NextResponse<ErrorPayload> {
  return NextResponse.json({ code, message }, { status });
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
    return errorResponse("PARSER_UNAVAILABLE", "解析服务暂时不可用，请确认 Python 服务已启动", 502);
  }

  if (!parserResponse.ok) {
    const payload = await readErrorPayload(parserResponse);
    return errorResponse(payload.code, payload.message, parserResponse.status);
  }

  try {
    const payload: unknown = await parserResponse.json();
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return errorResponse("PARSER_UNAVAILABLE", "解析服务返回了无效结果", 502);
  }
}
