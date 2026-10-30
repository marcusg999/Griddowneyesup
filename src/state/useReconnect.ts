import { useEffect, useRef } from 'react';

/**
 * Run something when the device plausibly has a network again.
 *
 * The app fetched once on mount and never again, which meant a phone that
 * walked back into WiFi — or found a bar of signal on the way home — kept
 * showing whatever it had read hours earlier until somebody thought to close
 * and reopen it. Nobody thinks to do that, least of all on the day it matters.
 *
 * Two triggers, because neither alone is enough:
 *
 *   `online` fires when the OS thinks connectivity returned. It is optimistic
 *   — it can fire for a captive portal that serves nothing — which is fine
 *   here, since the callback's failure path is silent and costs one request.
 *
 *   Returning to a backgrounded tab, because `online` fired while the page was
 *   suspended is exactly the event a sleeping phone misses.
 *
 * Nothing here is on a render path. This only ever fires an errand, and if
 * that errand fails the user keeps what they already had.
 */
export function useReconnect(onReconnect: () => void, enabled = true): void {
  // Kept in a ref so a caller passing an inline arrow does not re-subscribe on
  // every render, without forcing every caller to useCallback.
  const latest = useRef(onReconnect);
  useEffect(() => {
    latest.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const fire = (): void => {
      // navigator.onLine false is reliable in the negative: the OS is certain
      // there is no route. True is only a hint, which is why it is not a
      // precondition anywhere else.
      if (navigator.onLine === false) return;
      latest.current();
    };

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') fire();
    };

    window.addEventListener('online', fire);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', fire);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
