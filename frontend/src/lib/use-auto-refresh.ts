import { useEffect, useRef } from 'react';

/**
 * Calls `fetcher` on a poll plus whenever the tab regains focus, so the
 * currently-open admin view reflects employee-side edits without a manual
 * browser refresh.
 *
 * Behaviour:
 *   - Polls every `intervalMs` (default 30s) while document.visibilityState
 *     is 'visible'. Pauses when the tab is hidden so we don't burn CPU or
 *     bandwidth in a background tab.
 *   - Refetches immediately on visibilitychange → 'visible' and on window
 *     'focus' — covers the "admin alt-tabbed away and came back" case
 *     (where 30s is too long to wait).
 *   - Keeps the fetcher reference in a ref so callers don't have to
 *     memoise it themselves.
 *   - Pass `enabled: false` to turn off temporarily (useful when the page
 *     is in an editing state and shouldn't clobber local form data).
 */
export function useAutoRefresh(
  fetcher: () => void | Promise<void>,
  options?: { intervalMs?: number; enabled?: boolean },
) {
  const intervalMs = options?.intervalMs ?? 30000;
  const enabled = options?.enabled !== false;
  const fnRef = useRef(fetcher);
  fnRef.current = fetcher;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let timerId: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      try {
        const p = fnRef.current();
        if (p && typeof (p as Promise<void>).catch === 'function') {
          (p as Promise<void>).catch(() => {
            /* swallow — a transient failure shouldn't kill the poll */
          });
        }
      } catch {
        /* swallow */
      }
    };

    const start = () => {
      if (timerId !== null) return;
      timerId = setInterval(() => {
        if (document.visibilityState === 'visible') run();
      }, intervalMs);
    };
    const stop = () => {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        run();
        start();
      } else {
        stop();
      }
    };
    const onFocus = () => run();

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, intervalMs]);
}
