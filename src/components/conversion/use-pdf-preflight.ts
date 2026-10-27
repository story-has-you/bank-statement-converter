"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { conversionLimits } from "@/config/conversion";
import type { ConversionErrorPayload } from "@/lib/conversion-errors";
import { createClient } from "@/lib/supabase/browser";
import type { ConversionQuota } from "@/lib/usage/types";

class PreflightError extends Error {
  constructor(
    public readonly code: "unreadablePdf" | "passwordProtectedPdf" | "quotaUnavailable",
    public readonly serverMessage?: string,
  ) {
    super(code);
  }
}

type PreflightState =
  | { phase: "idle" }
  | { phase: "checking"; file: File; pageCount: number | null }
  | { phase: "ready"; file: File; pageCount: number; quota: ConversionQuota }
  | { phase: "error"; file: File; pageCount: number | null; error: PreflightError };

export function usePdfPreflight(file: File | null) {
  const locale = useLocale();
  const t = useTranslations("PdfUpload");
  const [state, setState] = useState<PreflightState>({ phase: "idle" });
  const active = useRef<AbortController | null>(null);
  const cachedPages = useRef<{ file: File; count: number } | null>(null);

  const cancel = useCallback(() => {
    active.current?.abort();
  }, []);

  const runCheck = useCallback(async (): Promise<boolean> => {
    cancel();
    if (!file) {
      cachedPages.current = null;
      return false;
    }

    const controller = new AbortController();
    active.current = controller;
    const previousCount = cachedPages.current?.file === file ? cachedPages.current.count : null;
    try {
      const pages = previousCount === null ? readPageCount(file, controller.signal) : Promise.resolve(previousCount);
      const [pageCount, quota] = await Promise.all([pages, fetchQuota(locale, controller.signal)]);
      if (controller.signal.aborted) {
        return false;
      }
      cachedPages.current = { file, count: pageCount };
      setState({ phase: "ready", file, pageCount, quota });
      return pageCount <= conversionLimits.pages && pageCount <= quota.remainingPages;
    } catch (error) {
      if (controller.signal.aborted) {
        return false;
      }
      controller.abort();
      const failure = error instanceof PreflightError ? error : new PreflightError("quotaUnavailable");
      setState({ phase: "error", file, pageCount: previousCount, error: failure });
      return false;
    }
  }, [cancel, file, locale]);

  const check = useCallback((): Promise<boolean> => {
    if (file) {
      const pageCount = cachedPages.current?.file === file ? cachedPages.current.count : null;
      setState({ phase: "checking", file, pageCount });
    }
    return runCheck();
  }, [file, runCheck]);

  useEffect(() => {
    void runCheck();
    return cancel;
  }, [runCheck, cancel]);

  useEffect(() => {
    const client = createClient();
    if (!client || !file) {
      return;
    }
    let identity: string | null | undefined;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      const nextIdentity = session?.user.id ?? null;
      if ((identity !== undefined && nextIdentity !== identity) || (identity === undefined && event === "SIGNED_OUT")) {
        void check();
      }
      identity = nextIdentity;
    });
    return () => data.subscription.unsubscribe();
  }, [check, file]);

  const current = state.phase !== "idle" && state.file === file ? state : null;
  const isChecking = file !== null && (!current || current.phase === "checking");
  const ready = current?.phase === "ready" ? current : null;
  let error: string | null = null;
  if (current?.phase === "error") {
    error = current.error.serverMessage ?? t(current.error.code);
  } else if (ready) {
    if (ready.pageCount > conversionLimits.pages) {
      error = t("tooManyPages", conversionLimits);
    } else if (ready.quota.remainingPages === 0) {
      error = t("quotaExhausted");
    } else if (ready.pageCount > ready.quota.remainingPages) {
      error = t("quotaExceeded", { pageCount: ready.pageCount, remainingPages: ready.quota.remainingPages });
    }
  }

  return {
    isChecking,
    pageCount: current?.pageCount ?? null,
    error,
    canConvert: ready !== null && error === null,
    canRetry: current?.phase === "error" && current.error.code === "quotaUnavailable",
    check,
    cancel,
  };
}

async function readPageCount(file: File, signal: AbortSignal): Promise<number> {
  const { openPdf } = await import("@/lib/conversion/local/pdf-reader");
  try {
    const { document, close } = await openPdf(file, signal);
    try {
      return document.numPages;
    } finally {
      await close();
    }
  } catch (error) {
    const encrypted = error instanceof Error && error.message === "PASSWORD_PROTECTED_PDF";
    throw new PreflightError(encrypted ? "passwordProtectedPdf" : "unreadablePdf");
  }
}

async function fetchQuota(locale: string, signal: AbortSignal): Promise<ConversionQuota> {
  const response = await fetch("/api/convert/quota", { headers: { "x-app-locale": locale }, cache: "no-store", signal });
  if (!response.ok) {
    const payload: ConversionErrorPayload = await response.json();
    throw new PreflightError("quotaUnavailable", payload.message);
  }
  return response.json();
}
