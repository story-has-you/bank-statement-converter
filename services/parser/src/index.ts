import { Container } from "@cloudflare/containers";

const PARSER_INSTANCE = "parser";

export class ParserContainer extends Container<Env> {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "10m";
  enableInternet = false;
  pingEndpoint = "/health";
}

function isAuthorized(request: Request, expectedSecret: string): boolean {
  const authorization = request.headers.get("Authorization") ?? "";
  const [scheme, suppliedSecret = ""] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !suppliedSecret) {
    return false;
  }

  const expectedBytes = new TextEncoder().encode(expectedSecret);
  const suppliedBytes = new TextEncoder().encode(suppliedSecret);
  const length = Math.max(expectedBytes.length, suppliedBytes.length);
  let difference = expectedBytes.length ^ suppliedBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (expectedBytes[index] ?? 0) ^ (suppliedBytes[index] ?? 0);
  }
  return difference === 0;
}

function unauthorized(): Response {
  return Response.json({ code: "UNAUTHORIZED", message: "解析服务认证失败" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

function notConfigured(): Response {
  return Response.json({ code: "PARSER_AUTH_NOT_CONFIGURED", message: "解析服务认证未配置" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function withNoStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const secret = env.PARSER_SHARED_SECRET?.trim();
    if (pathname !== "/health" && !secret) {
      return notConfigured();
    }

    if (pathname === "/parse" && !isAuthorized(request, secret)) {
      return unauthorized();
    }

    const container = env.PARSER_CONTAINER.getByName(PARSER_INSTANCE);
    await container.startAndWaitForPorts({ ports: [8080], startOptions: { envVars: { PARSER_SHARED_SECRET: secret } } });

    return withNoStore(await container.fetch(request));
  },
};

export default worker;
