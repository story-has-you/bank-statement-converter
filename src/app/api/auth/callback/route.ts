import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const response = NextResponse.redirect(new URL("/", origin));
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    }
  }

  const response = NextResponse.redirect(new URL("/auth/error", origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
