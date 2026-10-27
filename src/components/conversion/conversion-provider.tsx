"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations, type AppConfig } from "next-intl";
import { conversionLimits } from "@/config/conversion";
import { ConversionError } from "@/lib/conversion-errors";

import { createClient } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics";
import { usePathname } from "@/i18n/navigation";
import { clearConversionPayload, saveConversionPayload } from "@/lib/conversion-storage";
import { ConversionStreamError, readConversionStream, type ConversionPreview } from "@/lib/conversion-stream-client";
import type { ConversionMethod, ParseResponse } from "@/lib/conversion-types";

type ConversionState =
  | { phase: "idle" }
  | { phase: "pending"; filename: string; preview: ConversionPreview }
  | { phase: "complete"; filename: string; result: ParseResponse; storageFailed: boolean }
  | { phase: "error"; filename: string; message: string };
type ConversionContextValue = {
  state: ConversionState;
  revision: number;
  start: (file: File, method: ConversionMethod) => void;
  reset: () => void;
};
const ConversionContext = createContext<ConversionContextValue | null>(null);

export function ConversionProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations("ConversionResult.stream");
  const apiErrors = useTranslations("ApiErrors");
  const pathname = usePathname();
  const [state, setState] = useState<ConversionState>({ phase: "idle" });
  const [revision, setRevision] = useState(0);
  const active = useRef<AbortController | null>(null);
  const enteredResult = useRef(false);
  const previousLocale = useRef(locale);

  const reset = useCallback(() => {
    active.current?.abort();
    active.current = null;
    enteredResult.current = false;
    setState({ phase: "idle" });
    setRevision((value) => value + 1);
    try {
      clearConversionPayload();
    } catch {
      /* The next request reports storage failures. */
    }
  }, []);

  useEffect(() => {
    if (pathname === "/result") {
      enteredResult.current = true;
    } else if (enteredResult.current || pathname !== "/") {
      reset();
    }
  }, [pathname, reset]);

  useEffect(() => {
    if (previousLocale.current !== locale) {
      previousLocale.current = locale;
      reset();
    }
  }, [locale, reset]);

  useEffect(() => {
    const client = createClient();
    if (!client) {
      return;
    }
    let identity: string | null | undefined;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      const nextIdentity = session?.user.id ?? null;
      // INITIAL_SESSION establishes the baseline, preserving a refreshed result.
      if (identity !== undefined && nextIdentity !== identity) {
        reset();
      } else if (identity === undefined && event === "SIGNED_OUT") {
        reset();
      }
      identity = nextIdentity;
    });
    return () => data.subscription.unsubscribe();
  }, [reset]);

  useEffect(() => {
    function abortRequest(): void {
      active.current?.abort();
    }
    window.addEventListener("pagehide", abortRequest);
    return () => {
      abortRequest();
      window.removeEventListener("pagehide", abortRequest);
    };
  }, []);

  function start(file: File, method: ConversionMethod): void {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    enteredResult.current = false;
    try {
      clearConversionPayload();
    } catch {
      /* Saving is checked after completion. */
    }
    setState({ phase: "pending", filename: file.name, preview: { tables: [], stage: "reading" } });
    void (async () => {
      try {
        function onPreview(preview: ConversionPreview): void {
          if (active.current === controller && !controller.signal.aborted) {
            setState({ phase: "pending", filename: file.name, preview });
          }
        }
        let result: ParseResponse;
        if (method === "code") {
          const { parseWithPdfJs } = await import("@/lib/conversion/local/parser");
          result = await parseWithPdfJs(file, controller.signal, onPreview);
          controller.signal.throwIfAborted();
          onPreview({ stage: "finalizing", tables: result.tables });
          const response = await fetch("/api/convert/quota", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-app-locale": locale },
            body: JSON.stringify({ pageCount: result.pageCount }),
            signal: controller.signal,
          });
          if (!response.ok) {
            const payload = await response.json();
            throw new ConversionStreamError("request", payload.message);
          }
        } else {
          const body = new FormData();
          body.append("file", file);
          body.append("method", "llm");
          trackEvent("file_upload", { locale });
          const response = await fetch("/api/convert", {
            method: "POST",
            body,
            headers: { "x-app-locale": locale, Accept: "text/event-stream" },
            signal: controller.signal,
          });
          result = await readConversionStream(response, onPreview);
        }
        if (active.current !== controller || controller.signal.aborted) {
          return;
        }
        trackEvent("conversion_success", { locale, result_status: result.summary.status, page_count: result.pageCount });
        let storageFailed = false;
        try {
          saveConversionPayload(file.name, result);
        } catch {
          storageFailed = true;
        }
        setState({ phase: "complete", filename: file.name, result, storageFailed });
      } catch (error) {
        if (active.current !== controller || controller.signal.aborted) {
          return;
        }
        const code = error instanceof ConversionError ? (error.code as keyof AppConfig["Messages"]["ApiErrors"]) : null;
        let message = t("errors.request");
        if (code && apiErrors.has(code)) {
          message = apiErrors(code, conversionLimits);
        } else if (error instanceof ConversionStreamError) {
          message = error.serverMessage ?? t(`errors.${error.reason}`);
        }
        setState({ phase: "error", filename: file.name, message });
      } finally {
        if (active.current === controller) {
          active.current = null;
        }
      }
    })();
  }

  return <ConversionContext.Provider value={{ state, revision, start, reset }}>{children}</ConversionContext.Provider>;
}

export function useConversion(): ConversionContextValue {
  const value = useContext(ConversionContext);
  if (!value) {
    throw new Error("ConversionProvider is required");
  }
  return value;
}
