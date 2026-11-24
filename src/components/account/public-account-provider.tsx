"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { useLocale } from "next-intl";

import { trackTrialStart, trackVerifiedLogin } from "@/lib/analytics";
import { anonymousAccountSummary } from "@/lib/account/summary";
import { createAccountSummaryLoader, type PublicAccountState } from "@/lib/account/summary-loader";

type AccountState = PublicAccountState & { configured: boolean };
type AccountContext = AccountState & {
  user: { id: string; email: string | null; avatarUrl: string | null } | null;
  refresh: () => Promise<void>;
};
const PublicAccountContext = createContext<AccountContext | null>(null);
const loadingSummary: PublicAccountState = { status: "loading", summary: anonymousAccountSummary };

/** One session subscription and a refreshable summary shared by public page controls. */
export function PublicAccountProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const { isLoaded, user: clerkUser } = useUser();
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
    avatarUrl: clerkUser.hasImage ? clerkUser.imageUrl : null,
  } : null;
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const refresh = useCallback(() => refreshRef.current(), []);
  const userId = user?.id ?? null;
  const [loadedSummary, setLoadedSummary] = useState<{ userId: string | null; state: PublicAccountState }>();
  const state = loadedSummary?.userId === userId ? loadedSummary.state : loadingSummary;
  useEffect(() => {
    if (userId) { trackVerifiedLogin(userId, locale); }
  }, [userId, locale]);
  useEffect(() => {
    if (userId && state.status === "ready" && state.summary.user) {
      trackTrialStart(userId, locale, state.summary.activeTier !== null);
    }
  }, [userId, state.status, state.summary, locale]);
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const loader = createAccountSummaryLoader((next) => setLoadedSummary({ userId, state: next }));
    refreshRef.current = loader.refresh;
    loader.setUser(userId);
    return () => {
      loader.dispose();
      refreshRef.current = () => Promise.resolve();
    };
  }, [isLoaded, userId]);
  return <PublicAccountContext.Provider value={{ ...state, configured: isLoaded, user, refresh }}>{children}</PublicAccountContext.Provider>;
}

export function usePublicAccount(): AccountContext {
  const state = useContext(PublicAccountContext);
  if (!state) {
    throw new Error("PublicAccountProvider is required");
  }
  return state;
}
