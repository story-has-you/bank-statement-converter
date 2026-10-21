export type PollDecision = { kind: "pending" } | { kind: "done" } | { kind: "failed"; error: string };
export type PollState = PollDecision | { kind: "delayed" };

type StatusPollingOptions = {
  read: (signal: AbortSignal) => Promise<PollDecision>;
  initialDelayMs: number;
  onState: (state: PollState) => void;
};

/** Each round lasts 45 seconds, including its initial delay; each read gets at most 10 seconds. */
export function startStatusPolling({ read, initialDelayMs, onState }: StatusPollingOptions): () => void {
  const deadlineMs = 45_000;
  const deadline = performance.now() + deadlineMs;
  let stopped = false;
  let controller: AbortController | undefined;
  let nextTimer: ReturnType<typeof setTimeout>;
  let requestTimer: ReturnType<typeof setTimeout> | undefined;
  let finishWait: (() => void) | undefined;
  const deadlineTimer = setTimeout(expire, deadlineMs);

  function stop(): void {
    stopped = true;
    clearTimeout(nextTimer);
    clearTimeout(requestTimer);
    clearTimeout(deadlineTimer);
    controller?.abort();
    finishWait?.();
  }

  function expire(): void {
    stop();
    onState({ kind: "delayed" });
  }

  async function check(): Promise<void> {
    if (stopped) {
      return;
    }
    if (performance.now() >= deadline) {
      expire();
      return;
    }
    const request = new AbortController();
    controller = request;
    const requestDeadline = Math.min(performance.now() + 10_000, deadline);
    let decision: PollDecision = { kind: "pending" };
    try {
      // Settle our wait even when a reader does not react to its aborted signal.
      const timeout = new Promise<PollDecision>((resolve) => {
        finishWait = () => resolve({ kind: "pending" });
        requestTimer = setTimeout(() => {
          request.abort();
          finishWait?.();
        }, requestDeadline - performance.now());
      });
      decision = await Promise.race([read(request.signal), timeout]);
    } catch {
      // A read failure does not establish a payment or cancellation outcome.
    } finally {
      clearTimeout(requestTimer);
      finishWait = undefined;
    }
    if (stopped) {
      return;
    }
    if (performance.now() >= deadline) {
      expire();
      return;
    }
    if (!request.signal.aborted && performance.now() < requestDeadline && decision.kind !== "pending") {
      stop();
      onState(decision);
      return;
    }
    request.abort();
    nextTimer = setTimeout(check, 2_000);
  }

  nextTimer = setTimeout(() => {
    onState({ kind: "pending" });
    void check();
  }, initialDelayMs);
  return stop;
}
