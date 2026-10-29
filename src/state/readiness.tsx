import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { store } from '@/db';

/**
 * The readiness state machine. §3.
 *
 * This is the product's spine, not a skin: the whole interface reorganises
 * around the current state. Grey Sky in particular strips to four things and
 * suppresses every gamification element (policy G08).
 */
export type ReadinessState = 'blue-sky' | 'watch' | 'grey-sky';

interface ReadinessContextValue {
  readonly state: ReadinessState;
  readonly setState: (next: ReadinessState) => void;
  /** True when gamification must be hidden. Policy G08, enforced by test. */
  readonly suppressGamification: boolean;
}

const ReadinessContext = createContext<ReadinessContextValue>({
  state: 'blue-sky',
  setState: () => {},
  suppressGamification: false,
});

const META_KEY = 'readinessState';

export function ReadinessProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<ReadinessState>('blue-sky');

  useEffect(() => {
    void store.meta.get<ReadinessState>(META_KEY).then((saved) => {
      if (saved) setStateRaw(saved);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset['state'] = state;
  }, [state]);

  const setState = useCallback((next: ReadinessState) => {
    setStateRaw(next);
    void store.meta.put(META_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ state, setState, suppressGamification: state === 'grey-sky' }),
    [state, setState],
  );

  return <ReadinessContext.Provider value={value}>{children}</ReadinessContext.Provider>;
}

export const useReadiness = (): ReadinessContextValue => useContext(ReadinessContext);
