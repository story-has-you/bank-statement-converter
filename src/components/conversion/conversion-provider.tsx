"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/browser";
import { usePathname } from "@/i18n/navigation";
import { clearConversionPayload, saveConversionPayload } from "@/lib/conversion-storage";
import { ConversionStreamError, readConversionStream, type ConversionPreview } from "@/lib/conversion-stream-client";
import type { ParseResponse } from "@/lib/conversion-types";

type ConversionState =
  | { phase: "idle" }
  | { phase: "pending"; filename: string; preview: ConversionPreview }
  | { phase: "complete"; filename: string; result: ParseResponse; storageFailed: boolean }
  | { phase: "error"; filename: string; message: string };
type ConversionContextValue = { state: ConversionState; revision: number; start: (file: File) => void; reset: () => void };
const ConversionContext = createContext<ConversionContextValue | null>(null);

export function ConversionProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations("ConversionResult.stream");
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

  function start(file: File): void {
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
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/convert", {
          method: "POST",
          body,
          headers: { "x-app-locale": locale, Accept: "text/event-stream" },
          signal: controller.signal,
        });
        const result = await readConversionStream(response, (preview) => {
          if (active.current === controller && !controller.signal.aborted) {
            setState({ phase: "pending", filename: file.name, preview });
          }
        });
        if (active.current !== controller || controller.signal.aborted) {
          return;
        }
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
        const message = error instanceof ConversionStreamError ? (error.serverMessage ?? t(`errors.${error.reason}`)) : t("errors.request");
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
