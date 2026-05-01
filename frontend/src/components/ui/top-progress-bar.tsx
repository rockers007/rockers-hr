'use client';

import { useEffect, useState, useRef } from 'react';
import { API_INFLIGHT_EVENT } from '@/lib/api';

/**
 * Thin animated bar pinned to the top of the viewport that activates
 * whenever any `api.*` call is in flight. Mounted once at the root
 * layout — no per-page wiring needed.
 *
 * Behavior:
 *  - Listens for the `api:inflight` CustomEvent dispatched by
 *    `src/lib/api.ts` (count = number of pending fetches).
 *  - Shows after a short START_DELAY_MS (default 80ms) so it doesn't
 *    flash on instant requests.
 *  - When the count drops to zero, it animates to 100% then fades out
 *    after FINISH_HOLD_MS so the user gets a clear "done" signal.
 *  - Progress easing is artificial — fetch APIs don't expose real
 *    progress, so we use the ngprogress trick: jump quickly to ~30%,
 *    then asymptotically creep toward ~90% while the request is open;
 *    the actual completion fills the rest.
 *
 * Why DOM CustomEvent instead of a context/store: `api.ts` is a plain
 * module imported by every page (and indirectly by /lib/auth-store,
 * playwright tests, etc). Going through `window` keeps the api file
 * dependency-free of React. The component listens on mount and cleans
 * up on unmount.
 */
const START_DELAY_MS = 80;
const FINISH_HOLD_MS = 220;

export function TopProgressBar() {
  // `width` is a percentage 0–100; `visible` controls fade in/out.
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  // Refs avoid stale-closure issues inside the timers/RAFs that drive
  // the artificial progress easing.
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleRafRef = useRef<number | null>(null);
  const widthRef = useRef(0);

  useEffect(() => {
    function trickle() {
      // Asymptotic creep: each tick adds a fraction of the remaining
      // distance to 90, so we never reach 90 on our own — the actual
      // fetch completion bumps us to 100. Same idea as nprogress.
      const remaining = 90 - widthRef.current;
      if (remaining > 0.5) {
        widthRef.current = widthRef.current + remaining * 0.05;
        setWidth(widthRef.current);
      }
      trickleRafRef.current = requestAnimationFrame(trickle);
    }

    function startBar() {
      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      widthRef.current = 30;
      setWidth(30);
      setVisible(true);
      if (trickleRafRef.current) cancelAnimationFrame(trickleRafRef.current);
      trickleRafRef.current = requestAnimationFrame(trickle);
    }

    function finishBar() {
      if (trickleRafRef.current) {
        cancelAnimationFrame(trickleRafRef.current);
        trickleRafRef.current = null;
      }
      widthRef.current = 100;
      setWidth(100);
      finishTimerRef.current = setTimeout(() => {
        setVisible(false);
        // Reset width after fade-out so the next request starts fresh.
        setTimeout(() => {
          widthRef.current = 0;
          setWidth(0);
        }, 200);
      }, FINISH_HOLD_MS);
    }

    function onInflight(e: Event) {
      const count = (e as CustomEvent<{ count: number }>).detail.count;
      if (count > 0) {
        // Defer the actual show by START_DELAY_MS — most fetches
        // resolve in 30–60ms and would otherwise flash a bar for no
        // reason.
        if (!visible && !startTimerRef.current) {
          startTimerRef.current = setTimeout(() => {
            startTimerRef.current = null;
            startBar();
          }, START_DELAY_MS);
        }
      } else {
        // Count back to zero before the start delay fired — cancel the
        // pending show entirely. This is the "instant fetch" case.
        if (startTimerRef.current) {
          clearTimeout(startTimerRef.current);
          startTimerRef.current = null;
          return;
        }
        if (visible) finishBar();
      }
    }

    window.addEventListener(API_INFLIGHT_EVENT, onInflight as EventListener);
    return () => {
      window.removeEventListener(API_INFLIGHT_EVENT, onInflight as EventListener);
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (trickleRafRef.current) cancelAnimationFrame(trickleRafRef.current);
    };
    // `visible` is intentionally read inside via the closure above —
    // re-running the effect on every visibility change would clobber
    // the currently-running timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease-out',
      }}
    >
      <div
        className="h-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.6)]"
        style={{
          width: `${width}%`,
          transition: 'width 200ms ease-out',
        }}
      />
    </div>
  );
}
