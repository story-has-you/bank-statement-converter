"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { anonymousAccountSummary } from "@/lib/account/summary";
import { createAccountSummaryLoader, type PublicAccountState } from "@/lib/account/summary-loader";
import { createClient } from "@/lib/supabase/browser";

type AccountState = PublicAccountState & { configured: boolean };
type AccountContext = AccountState & { refresh: () => Promise<void> };
const PublicAccountContext = createContext<AccountContext | null>(null);

/** One session subscription and a refreshable summary shared by public page controls. */
export function PublicAccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>({ status: "loading", configured: false, summary: anonymousAccountSummary });
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    const client = createClient();
    let disposed = false;
    if (!client) {
      queueMicrotask(() => {
        if (!disposed) {
          setState({ status: "ready", configured: false, summary: anonymousAccountSummary });
        }
      });
      return () => {
        disposed = true;
      };
    }
    const loader = createAccountSummaryLoader((next) => setState({ ...next, configured: true }));
    refreshRef.current = loader.refresh;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      loader.setUser(session?.user.id ?? null);
    });
    return () => {
      loader.dispose();
      refreshRef.current = () => Promise.resolve();
      data.subscription.unsubscribe();
    };
  }, []);
  return <PublicAccountContext.Provider value={{ ...state, refresh }}>{children}</PublicAccountContext.Provider>;
}

export function usePublicAccount(): AccountContext {
  const state = useContext(PublicAccountContext);
  if (!state) {
    throw new Error("PublicAccountProvider is required");
  }
  return state;
}
