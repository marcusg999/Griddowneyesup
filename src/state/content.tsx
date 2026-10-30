import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { installContentPack, readInstalledPack, type LoadedPack } from '@/content/pack';
import { store } from '@/db';
import { useReconnect } from './useReconnect';

/**
 * Content availability.
 *
 * Reads from IndexedDB first and renders from whatever is there. The network
 * refresh runs afterwards and never blocks a render (ARCHITECTURE §0).
 *
 * `status` has no 'error' member on purpose. If content cannot be refreshed,
 * the installed pack is still correct and the user is not shown a failure for
 * something that did not fail.
 *
 * The refresh is also retried when connectivity returns. An install that first
 * ran with no network had no way back to a current library until the app was
 * reopened, which is the wrong moment to discover the pack is six weeks old.
 */
interface ContentContextValue {
  readonly pack: LoadedPack | undefined;
  readonly status: 'loading' | 'ready' | 'empty';
}

const ContentContext = createContext<ContentContextValue>({
  pack: undefined,
  status: 'loading',
});

export function ContentProvider({ children }: { children: ReactNode }) {
  const [pack, setPack] = useState<LoadedPack | undefined>();
  const [status, setStatus] = useState<ContentContextValue['status']>('loading');

  // One refresh at a time: the mount path and a reconnect can otherwise race
  // to install the same pack.
  const inFlight = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const updated = await installContentPack();
      if (!updated) {
        // Nothing new, which is the normal outcome. The only thing left to
        // settle is a first boot that never got a pack at all — otherwise the
        // status stays on whatever the installed pack already set.
        setStatus((current) => (current === 'loading' ? 'empty' : current));
        return;
      }
      const refreshed = await readInstalledPack();
      setPack(refreshed);
      setStatus(refreshed ? 'ready' : 'empty');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // 1. Render from what is already installed.
      const installed = await readInstalledPack();
      if (cancelled) return;
      if (installed) {
        setPack(installed);
        setStatus('ready');

        // Booting the whole library with the radio off is the user verifying
        // the one claim this product makes. It is a real-world act — they
        // turned the network off — not a reward for opening an app.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          void store.achievements.award('cold-start');
        }
      }

      // 2. Then try to refresh. Offline is the expected path, not an error.
      //    Through the same guarded path a reconnect uses, so the two cannot
      //    race to install the same pack.
      if (cancelled) return;
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useReconnect(() => {
    void refresh();
  });

  return (
    <ContentContext.Provider value={{ pack, status }}>{children}</ContentContext.Provider>
  );
}

export const useContent = (): ContentContextValue => useContext(ContentContext);
