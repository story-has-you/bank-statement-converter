import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "./config";

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; the proxy refreshes them.
        }
      },
    },
  });
}

/** Reuses verified identity only within one Server Component render request. */
export const getRenderAuthContext = cache(async () => {
  const client = await createClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  return { configured: Boolean(client), user };
});
