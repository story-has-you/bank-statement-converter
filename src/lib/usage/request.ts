import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  createAnonymousId,
  getEntitledSubscription,
  getQuotaContext,
  getUsageRecord,
  hashAnonymousId,
  isUsageRecordCurrent,
} from "@/lib/usage/server";
import type { UsageActor } from "@/lib/usage/server";
import type { ConversionQuota } from "@/lib/usage/types";

const ANONYMOUS_COOKIE = "bank-statement-converter-anonymous";

export async function setAnonymousCookie(response: NextResponse | Promise<NextResponse>, value: string | null): Promise<NextResponse> {
  const resolvedResponse = await response;
  if (value) {
    resolvedResponse.cookies.set({
      name: ANONYMOUS_COOKIE,
      value,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return resolvedResponse;
}

async function getRequestActor(request: Request): Promise<{ actor: UsageActor; cookieValue: string | null }> {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (user) {
    return { actor: { type: "user", key: user.id, email: user.email ?? null }, cookieValue: null };
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(ANONYMOUS_COOKIE)?.value;
  const cookieValue = existingCookie ?? createAnonymousId();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const clientAddress = forwarded || request.headers.get("x-real-ip")?.trim();
  const actorKey = clientAddress ? hashAnonymousId(`network:${clientAddress}`) : hashAnonymousId(`cookie:${cookieValue}`);
  return { actor: { type: "anonymous", key: actorKey, email: null }, cookieValue: existingCookie ? null : cookieValue };
}

export async function getRequestQuota(request: Request) {
  const { actor, cookieValue } = await getRequestActor(request);
  const subscription = actor.type === "user" ? await getEntitledSubscription(actor.key) : null;
  const context = getQuotaContext(actor, subscription);
  const currentUsage = await getUsageRecord(actor);
  const usedPages = currentUsage && isUsageRecordCurrent(currentUsage, context) ? currentUsage.used_pages : 0;
  const quota: ConversionQuota = {
    remainingPages: Math.max(0, context.limitPages - usedPages),
    limitPages: context.limitPages,
    period: context.window.period,
    periodEnd: context.window.end.toISOString(),
  };
  return { context, subscription, quota, usedPages, anonymousCookie: cookieValue };
}
