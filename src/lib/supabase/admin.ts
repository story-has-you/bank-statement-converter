import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

export function createAdminClient() {
  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!config || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(config.url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
