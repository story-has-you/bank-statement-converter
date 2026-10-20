import { anonymousAccountSummary, type PublicAccountSummary } from "./summary";

export type PublicAccountState = { status: "loading" | "ready" | "error"; summary: PublicAccountSummary };

/** Invalidate older reads immediately and coalesce same-turn refreshes into one request. */
export function createAccountSummaryLoader(onChange: (state: PublicAccountState) => void) {
  let userId: string | null = null;
  let summary = anonymousAccountSummary;
  let disposed = false;
  let request: AbortController | null = null;
  let scheduled: Promise<void> | null = null;

  function invalidate() {
    request?.abort();
    request = null;
  }

  function refresh(): Promise<void> {
    if (disposed || !userId) {
      return Promise.resolve();
    }
    invalidate();
    onChange({ status: "loading", summary });
    if (!scheduled) {
      scheduled = Promise.resolve().then(async () => {
        scheduled = null;
        if (disposed || !userId) {
          return;
        }
        const requestUserId = userId;
        const controller = new AbortController();
        request = controller;
        const isCurrent = () => !disposed && request === controller && !controller.signal.aborted && userId === requestUserId;
        try {
          const response = await fetch("/api/account/summary", { cache: "no-store", signal: controller.signal });
          if (!response.ok) {
            throw new Error("Account summary unavailable");
          }
          const next: PublicAccountSummary = await response.json();
          if (isCurrent()) {
            summary = next;
            onChange({ status: "ready", summary });
          }
        } catch {
          if (isCurrent()) {
            onChange({ status: "error", summary });
          }
        } finally {
          if (request === controller) {
            request = null;
          }
        }
      });
    }
    return scheduled;
  }

  return {
    refresh,
    setUser(nextUserId: string | null) {
      if (disposed) {
        return;
      }
      if (userId !== nextUserId) {
        invalidate();
        userId = nextUserId;
        summary = anonymousAccountSummary;
      }
      if (userId) {
        void refresh();
      } else {
        onChange({ status: "ready", summary: anonymousAccountSummary });
      }
    },
    dispose() {
      disposed = true;
      invalidate();
    },
  };
}
