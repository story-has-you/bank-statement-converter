import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { isClerkUserId } from "@/lib/auth/identity";
import { getDatabase } from "@/lib/db/server";

export async function POST(request: NextRequest): Promise<Response> {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return new Response(null, { status: 503 });
  }

  let event;
  try {
    event = await verifyWebhook(request, { signingSecret });
  } catch {
    return new Response(null, { status: 400 });
  }
  if (event.type !== "user.deleted") {
    return new Response(null, { status: 204 });
  }

  const userId = event.data.id;
  if (!isClerkUserId(userId)) {
    return new Response(null, { status: 400 });
  }

  try {
    const db = getDatabase();
    await db.batch([
      db.prepare("INSERT INTO deleted_accounts (user_id) VALUES (?) ON CONFLICT DO NOTHING").bind(userId),
      db.prepare("DELETE FROM conversion_parse_records WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM conversion_usage WHERE actor_type = 'user' AND actor_key = ?").bind(userId),
      db.prepare("DELETE FROM billing_subscriptions WHERE user_id = ?").bind(userId),
    ]);
    return new Response(null, { status: 204 });
  } catch {
    console.error("AUTH_ACCOUNT_DELETE_FAILED");
    return new Response(null, { status: 503 });
  }
}
