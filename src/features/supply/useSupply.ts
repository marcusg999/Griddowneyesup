import { useCallback, useEffect, useState } from 'react';
import { store } from '@/db';
import type { InventoryRecord, Profile } from '@/db/types';
import { useContent } from '@/state/content';
import { computeCoverage, type Coverage } from './coverage';
import { kitStatus, ladderWithLocks } from './kits';
import type { KitId } from '@/content/types';

/**
 * A sane starting household so the app is useful before any onboarding.
 * Asking someone to fill in a profile before showing them anything is the
 * signup wall problem wearing a different hat.
 */
export const DEFAULT_PROFILE: Profile = {
  id: 'self',
  members: [{ id: 'm1', label: 'You', ageBand: 'adult' }],
  pets: 0,
  hazards: [],
  targetHorizonDays: 3,
  carryFraction: 0.2,
};

export function useSupply() {
  const { pack } = useContent();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [saved, records] = await Promise.all([
      store.profile.get(),
      store.inventory.all(),
    ]);
    setProfile(saved ?? DEFAULT_PROFILE);
    setInventory(records);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const coverage: Coverage[] = pack
    ? computeCoverage(profile, inventory, pack.items)
    : [];

  const statuses = new Map<KitId, ReturnType<typeof kitStatus>>();
  if (pack) {
    for (const kit of pack.kits) {
      statuses.set(kit.id, kitStatus(kit, inventory, pack.items, profile));
    }
  }
  const ladder = pack ? ladderWithLocks(pack.kits, statuses) : [];

  const addItem = useCallback(
    async (itemId: string, quantity: number, kits: KitId[]) => {
      const existing = inventory.find(
        (r) => r.itemId === itemId && r.kits.join() === kits.join(),
      );
      const record: InventoryRecord = existing
        ? { ...existing, quantity: existing.quantity + quantity }
        : {
            id: `${itemId}-${Date.now()}`,
            itemId,
            quantity,
            kits,
            addedAt: new Date().toISOString(),
          };
      await store.inventory.put(record);
      await reload();
    },
    [inventory, reload],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await store.inventory.remove(id);
      await reload();
    },
    [reload],
  );

  return { profile, setProfile, inventory, coverage, ladder, loading, addItem, removeItem, reload };
}
