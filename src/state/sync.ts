import { useEffect, useState } from 'react';
import { store } from '@/db';

/**
 * When anything was last pulled successfully.
 *
 * The status bar used to say "Never synced. Everything here still works."
 * unconditionally, which was true on day one and a lie from the first refresh
 * onwards. The second half stayed true throughout, which is probably why
 * nobody noticed the first half had stopped being.
 *
 * "Last synced" means the last time a fetch actually landed — not the digest's
 * publish date, which is a fact about the publisher rather than about this
 * device. A phone that has been in a basement for two days should say so even
 * if the digest it holds was cut an hour before it went down there.
 *
 * The write broadcasts, so the status bar updates when a background refresh
 * succeeds rather than waiting for a re-render that may never come.
 */

const META_KEY = 'lastSyncedAt';
const EVENT = 'ballast:synced';

export async function recordSync(at: Date = new Date()): Promise<void> {
  const iso = at.toISOString();
  await store.meta.put(META_KEY, iso);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: iso }));
  }
}

export function useLastSynced(): { lastSyncedAt: string | undefined; online: boolean } {
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    let live = true;
    void store.meta.get<string>(META_KEY).then((value) => {
      if (live) setLastSyncedAt(value);
    });

    const onSynced = (event: Event): void => {
      const detail = (event as CustomEvent<string>).detail;
      if (live && typeof detail === 'string') setLastSyncedAt(detail);
    };
    const onOnline = (): void => setOnline(true);
    const onOffline = (): void => setOnline(false);

    window.addEventListener(EVENT, onSynced);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      live = false;
      window.removeEventListener(EVENT, onSynced);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { lastSyncedAt, online };
}
