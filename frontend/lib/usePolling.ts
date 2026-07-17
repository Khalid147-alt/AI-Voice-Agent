"use client";

import { useEffect, useRef } from "react";

/**
 * Periodically invoke `callback` on an interval — the serverless-friendly
 * replacement for the old WebSocket live feed. Vercel functions can't hold a
 * long-lived socket open, so the dashboard/calls/campaign views poll the REST
 * API instead.
 *
 * Polling pauses while the tab is hidden (to avoid wasted requests) and fires
 * once immediately when the tab becomes visible again, so returning to the tab
 * shows fresh data without waiting a full interval.
 *
 * @param callback   async or sync refresh function (kept in a ref so the
 *                   interval isn't torn down when the callback identity changes)
 * @param intervalMs polling cadence in milliseconds (default 4000)
 * @param enabled    set false to suspend polling entirely
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs = 4000,
  enabled = true
) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      // Skip work when the tab is in the background.
      if (typeof document !== "undefined" && document.hidden) return;
      void savedCallback.current();
    };

    const start = () => {
      if (timer === null) timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void savedCallback.current(); // refresh immediately on return
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
