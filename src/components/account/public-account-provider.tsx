"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { anonymousAccountSummary, type PublicAccountSummary } from "@/lib/account/summary";
import { createClient } from "@/lib/supabase/browser";

type AccountState = { status: "loading" | "ready" | "error"; configured: boolean; summary: PublicAccountSummary };
const PublicAccountContext = createContext<AccountState | null>(null);

/** One session subscription and one read-only request shared by public page controls. */
export function PublicAccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>({ status: "loading", configured: false, summary: anonymousAccountSummary });
  useEffect(() => {
    const client = createClient();
    const controller = new AbortController();
    let generation = 0;
    if (!client) {
      queueMicrotask(() => setState({ status: "ready", configured: false, summary: anonymousAccountSummary }));
      return;
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const request = ++generation;
      if (!session) {
        setState({ status: "ready", configured: true, summary: anonymousAccountSummary });
        return;
      }
      setState({ status: "loading", configured: true, summary: anonymousAccountSummary });
      void fetch("/api/account/summary", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Account summary unavailable");
          }
          const summary: PublicAccountSummary = await response.json();
          if (request === generation) {
            setState({ status: "ready", configured: true, summary });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted && request === generation) {
            setState({ status: "error", configured: true, summary: anonymousAccountSummary });
          }
        });
    });
    return () => {
      generation++;
      controller.abort();
      data.subscription.unsubscribe();
    };
  }, []);
  return <PublicAccountContext.Provider value={state}>{children}</PublicAccountContext.Provider>;
}

export function usePublicAccount(): AccountState {
  const state = useContext(PublicAccountContext);
  if (!state) {
    throw new Error("PublicAccountProvider is required");
  }
  return state;
}
