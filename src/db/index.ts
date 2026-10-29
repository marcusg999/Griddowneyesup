import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { cipher } from './cipher';
import { STORE_SENSITIVITY } from './types';
import type {
  Achievement,
  DrillLog,
  InventoryRecord,
  Profile,
  ReadinessSnapshot,
  SkillProgress,
} from './types';
import type { Sensitivity } from '@/content/types';
import type { Contact, Plan } from '@/features/plan/types';

/**
 * IndexedDB is the PRIMARY data source, not a cache.
 *
 * The UI reads from here. Always. Nothing on a render path awaits the network
 * (ARCHITECTURE §0), and the offline suite asserts it.
 */

const DB_NAME = 'ballast';
const DB_VERSION = 2;

interface Schema extends DBSchema {
  profile: { key: string; value: unknown };
  /** Sensitive. Rally points, shutoffs, duress codes. Never transmitted. */
  plan: { key: string; value: unknown };
  /** Sensitive. Names and numbers of real people. Never transmitted. */
  contacts: { key: string; value: unknown };
  inventory: { key: string; value: unknown; indexes: { 'by-item': string } };
  achievements: { key: string; value: unknown };
  skillProgress: { key: string; value: unknown };
  readinessSnapshots: { key: string; value: unknown };
  drills: { key: string; value: unknown };
  /** Decoded content pack artifacts, keyed by artifact name. */
  content: { key: string; value: unknown };
  /** Pack version, last sync time, install state. */
  meta: { key: string; value: unknown };
}

/**
 * Explicit union rather than `keyof Schema`: idb's DBSchema carries an index
 * signature, so `keyof` widens to `string` and loses the store names.
 */
type StoreName =
  | 'profile'
  | 'plan'
  | 'contacts'
  | 'inventory'
  | 'achievements'
  | 'skillProgress'
  | 'readinessSnapshots'
  | 'drills'
  | 'content'
  | 'meta';

let dbPromise: Promise<IDBPDatabase<Schema>> | undefined;

export function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    // Versioned rather than recreated: an existing install holds the user's
    // inventory, and a migration that drops it to add a store would be a data
    // loss bug in a product people rely on.
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('profile');
        const inventory = database.createObjectStore('inventory');
        inventory.createIndex('by-item', 'itemId');
        database.createObjectStore('achievements');
        database.createObjectStore('skillProgress');
        database.createObjectStore('readinessSnapshots');
        database.createObjectStore('drills');
        database.createObjectStore('content');
        database.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        database.createObjectStore('plan');
        database.createObjectStore('contacts');
      }
    },
  });
  return dbPromise;
}

/** Test seam. */
export function resetDbHandle(): void {
  dbPromise = undefined;
}

function sensitivityOf(store: StoreName): Sensitivity {
  return STORE_SENSITIVITY[store] ?? 'local';
}

async function put(store: StoreName, key: string, value: unknown): Promise<void> {
  const encoded = await cipher().encode(value, sensitivityOf(store));
  await (await db()).put(store, encoded, key);
}

async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const raw = await (await db()).get(store, key);
  if (raw === undefined) return undefined;
  return (await cipher().decode(raw, sensitivityOf(store))) as T;
}

async function all<T>(store: StoreName): Promise<T[]> {
  const raw = await (await db()).getAll(store);
  const s = sensitivityOf(store);
  return Promise.all(raw.map((r) => cipher().decode(r, s))) as Promise<T[]>;
}

// ---------------------------------------------------------------------------
// Typed accessors
// ---------------------------------------------------------------------------

export const store = {
  profile: {
    get: () => get<Profile>('profile', 'self'),
    put: (p: Profile) => put('profile', 'self', p),
  },

  plan: {
    get: () => get<Plan>('plan', 'household'),
    put: (p: Plan) => put('plan', 'household', { ...p, updatedAt: new Date().toISOString() }),
  },

  contacts: {
    all: () => all<Contact>('contacts'),
    put: (c: Contact) => put('contacts', c.id, c),
    async remove(id: string): Promise<void> {
      await (await db()).delete('contacts', id);
    },
  },

  inventory: {
    all: () => all<InventoryRecord>('inventory'),
    get: (id: string) => get<InventoryRecord>('inventory', id),
    put: (r: InventoryRecord) => put('inventory', r.id, r),
    async remove(id: string): Promise<void> {
      await (await db()).delete('inventory', id);
    },
  },

  achievements: {
    all: () => all<Achievement>('achievements'),
    async award(slug: string, evidence?: string): Promise<boolean> {
      const existing = await get<Achievement>('achievements', slug);
      // Achievements are earned once. Re-awarding would let a mechanic reward
      // repetition of an app action, which policy G01-G07 forbids.
      if (existing) return false;
      await put('achievements', slug, {
        slug,
        earnedAt: new Date().toISOString(),
        ...(evidence ? { evidence } : {}),
      } satisfies Achievement);
      return true;
    },
  },

  skillProgress: {
    all: () => all<SkillProgress>('skillProgress'),
    get: (skillId: string) => get<SkillProgress>('skillProgress', skillId),
    async markRead(skillId: string): Promise<void> {
      const current = (await get<SkillProgress>('skillProgress', skillId)) ?? { skillId };
      await put('skillProgress', skillId, {
        ...current,
        readAt: current.readAt ?? new Date().toISOString(),
      });
    },
    async markPracticed(skillId: string, notes?: string): Promise<void> {
      const current = (await get<SkillProgress>('skillProgress', skillId)) ?? { skillId };
      await put('skillProgress', skillId, {
        ...current,
        readAt: current.readAt ?? new Date().toISOString(),
        practicedAt: new Date().toISOString(),
        ...(notes ? { notes } : {}),
      });
    },
  },

  snapshots: {
    all: () => all<ReadinessSnapshot>('readinessSnapshots'),
    put: (s: ReadinessSnapshot) => put('readinessSnapshots', s.date, s),
  },

  drills: {
    all: () => all<DrillLog>('drills'),
    put: (d: DrillLog) => put('drills', d.id, d),
  },

  content: {
    get: <T>(artifact: string) => get<T>('content', artifact),
    put: (artifact: string, value: unknown) => put('content', artifact, value),
  },

  meta: {
    get: <T>(key: string) => get<T>('meta', key),
    put: (key: string, value: unknown) => put('meta', key, value),
  },
} as const;
