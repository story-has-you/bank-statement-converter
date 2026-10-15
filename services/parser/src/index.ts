import { timingSafeEqual } from "node:crypto";
import { Container } from "@cloudflare/containers";

export class ParserContainer extends Container<Env> {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "10m";
  enableInternet = false;
}

function isAuthorized(request: Request, secret: string): boolean {
  const authorization = request.headers.get("Authorization") ?? "";
  const [scheme, token = ""] = authorization.trim().split(/\s+/, 2);
  const expected = new TextEncoder().encode(secret);
  const supplied = new TextEncoder().encode(token);
  return scheme?.toLowerCase() === "bearer" && expected.byteLength === supplied.byteLength && timingSafeEqual(expected, supplied);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const secret = env.PARSER_SHARED_SECRET?.trim();
    if (!secret) {
      return Response.json({ code: "PARSER_AUTH_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (pathname === "/parse" && !isAuthorized(request, secret)) {
      return Response.json({ code: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const container = env.PARSER_CONTAINER.getByName("parser");
    await container.startAndWaitForPorts({ ports: [8080], startOptions: { envVars: { PARSER_SHARED_SECRET: secret } } });
    const response = await container.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<Env>;
