import { useCallback, useEffect, useRef, useState } from 'react';
import { useReconnect } from '@/state/useReconnect';
import { refreshSnapshot, storedSnapshot } from './snapshot';
import type { ThreatSnapshot } from './types';

/**
 * The digest, read the only way it is allowed to be read.
 *
 * `loading` is true only while IndexedDB is being read, which is local and
 * fast. It is never true while a network request is outstanding: the refresh
 * is fired after the stored digest has already been handed to the renderer,
 * and if it never comes back nobody waits and nothing changes.
 *
 * That ordering is the whole point. It is the one place in the app where a
 * network exists, so it is the one place the premise could be lost.
 *
 * The refresh also runs when connectivity returns, not only on mount. A phone
 * that regains a bar of signal should pull then, rather than when somebody
 * happens to reopen the app — which, on the day it matters, is never.
 */
export function useThreat(region: string): {
  snapshot: ThreatSnapshot | undefined;
  loading: boolean;
  /** When the stored digest was published, for the sync line. */
  lastSyncedAt: string | undefined;
} {
  const [snapshot, setSnapshot] = useState<ThreatSnapshot | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // One refresh at a time PER REGION. The reconnect triggers can land together
  // — `online` and a tab becoming visible are the same moment on a waking
  // phone — and firing two fetches at the same digest wins nothing.
  //
  // Per region rather than one flag, because a single flag loses the digest
  // when the county changes: the profile loads after first render, so the
  // region goes 'default' -> '06075' with the first fetch still out, and a
  // bare guard makes the second refresh return early and never fetch.
  const inFlight = useRef<Set<string>>(new Set());
  const live = useRef(true);

  // The region the UI is actually showing, so a result that arrives after the
  // county changed is discarded rather than rendered over the new one.
  const current = useRef(region);
  useEffect(() => {
    current.current = region;
  }, [region]);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const target = current.current;
    if (inFlight.current.has(target)) return;
    inFlight.current.add(target);
    try {
      const fresher = await refreshSnapshot(target);
      if (live.current && fresher && current.current === target) setSnapshot(fresher);
    } finally {
      inFlight.current.delete(target);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored = await storedSnapshot(region);
      if (!active) return;

      // Render path ends here. Everything below is an errand.
      setSnapshot(stored);
      setLoading(false);

      await refresh();
    })();

    return () => {
      active = false;
    };
  }, [region, refresh]);

  useReconnect(() => {
    void refresh();
  });

  return { snapshot, loading, lastSyncedAt: snapshot?.publishedAt };
}
