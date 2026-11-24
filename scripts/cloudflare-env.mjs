import { readFileSync, writeFileSync } from "node:fs";

const modulePath = new URL("../.open-next/cloudflare/next-env.mjs", import.meta.url);
const emptyEnvironment = "export const production = {};\nexport const development = {};\nexport const test = {};\n";

if (process.argv[2] === "--check") {
  if (readFileSync(modulePath, "utf8") !== emptyEnvironment) {
    throw new Error("Run pnpm cf:build before deploying. The OpenNext environment module may contain local credentials.");
  }
} else {
  // OpenNext copies local .env values into this module. Workers get runtime settings from bindings and Secrets.
  writeFileSync(modulePath, emptyEnvironment);
}
