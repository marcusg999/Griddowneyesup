import { useEffect, useState } from 'react';
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
 */
export function useThreat(region: string): {
  snapshot: ThreatSnapshot | undefined;
  loading: boolean;
} {
  const [snapshot, setSnapshot] = useState<ThreatSnapshot | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    void (async () => {
      const stored = await storedSnapshot(region);
      if (!live) return;

      // Render path ends here. Everything below is an errand.
      setSnapshot(stored);
      setLoading(false);

      const fresher = await refreshSnapshot(region);
      if (live && fresher) setSnapshot(fresher);
    })();

    return () => {
      live = false;
    };
  }, [region]);

  return { snapshot, loading };
}
