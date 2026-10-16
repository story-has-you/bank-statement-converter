import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import nextEnv from "@next/env";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
nextEnv.loadEnvConfig(projectDir, true);

const children = [];
let stopping = false;

function stop(code) {
  if (stopping) {
    return;
  }
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") {
          throw error;
        }
      }
    }
  }
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit", detached: true });
  children.push(child);
  child.on("error", () => {
    console.error("开发服务启动失败，请检查本地运行环境。");
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
  return child;
}

async function isParserHealthy(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(500) });
    return response.ok && (await response.json()).status === "ok";
  } catch {
    return false;
  }
}

async function main() {
  const baseUrl = (process.env.PARSER_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const parserUrl = new URL(baseUrl);
  const secret = process.env.PARSER_SHARED_SECRET?.trim();
  if (!secret) {
    throw new Error("请在根目录 .env.local 配置 PARSER_SHARED_SECRET。");
  }

  if (["127.0.0.1", "localhost"].includes(parserUrl.hostname) && parserUrl.port === "8000") {
    if (!(await isParserHealthy(baseUrl))) {
      const parserDir = `${projectDir}services/parser`;
      const python = `${parserDir}/.venv/bin/python`;
      if (!existsSync(python)) {
        throw new Error("缺少解析服务虚拟环境，请按 services/parser/README.md 安装 Python 依赖。");
      }
      start(python, ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"], parserDir);
      const deadline = Date.now() + 10_000;
      while (!stopping && !(await isParserHealthy(baseUrl))) {
        if (Date.now() >= deadline) {
          throw new Error("解析服务未能在 8000 端口就绪，请检查启动日志。");
        }
        await setTimeout(200);
      }
      if (stopping) {
        return;
      }
    }

    // An invalid content type checks authentication without parsing or consuming quota.
    const response = await fetch(`${baseUrl}/parse`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status !== 400 || (await response.json()).code !== "INVALID_FILE_TYPE") {
      throw new Error("8000 端口的解析服务认证失败，请确认它使用根目录 .env.local 中的 PARSER_SHARED_SECRET。");
    }
    console.log("本地解析服务已就绪：http://127.0.0.1:8000");
  }

  const nextBin = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
  const args = process.argv.slice(2);
  start(process.execPath, [nextBin, "dev", ...(args.length ? args : ["--port", "3000"])], projectDir);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
main().catch((error) => {
  console.error(error.message);
  stop(1);
});
