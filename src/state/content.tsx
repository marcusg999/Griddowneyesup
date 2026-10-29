import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { installContentPack, readInstalledPack, type LoadedPack } from '@/content/pack';
import { store } from '@/db';

/**
 * Content availability.
 *
 * Reads from IndexedDB first and renders from whatever is there. The network
 * refresh runs afterwards and never blocks a render (ARCHITECTURE §0).
 *
 * `status` has no 'error' member on purpose. If content cannot be refreshed,
 * the installed pack is still correct and the user is not shown a failure for
 * something that did not fail.
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
      const updated = await installContentPack();
      if (cancelled) return;
      if (updated || !installed) {
        const refreshed = await readInstalledPack();
        if (cancelled) return;
        setPack(refreshed);
        setStatus(refreshed ? 'ready' : 'empty');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ContentContext.Provider value={{ pack, status }}>{children}</ContentContext.Provider>
  );
}

export const useContent = (): ContentContextValue => useContext(ContentContext);
