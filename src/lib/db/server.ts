/// <reference types="@cloudflare/workers-types" />

import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDatabase(): D1Database {
  const db = getCloudflareContext().env.DB;
  if (!db) {
    throw new Error("D1 database binding is missing");
  }
  return db;
}
