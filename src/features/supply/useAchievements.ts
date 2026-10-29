import { useCallback, useEffect, useState } from 'react';
import { store } from '@/db';
import type { Achievement } from '@/db/types';
import { useContent } from '@/state/content';
import { usePlan } from '@/features/plan/usePlan';
import { earnedAchievements, STANDING_SLUGS, type AchievementSlug } from './achievements';
import type { InventoryRecord, Profile } from '@/db/types';

/**
 * Evaluates achievements from stored state and awards any that are newly met.
 *
 * Recomputed rather than event-driven, so an achievement cannot be missed
 * because the app happened to be closed when the condition became true — and
 * cannot be farmed by repeating an action, since `award` is idempotent.
 */
export function useAchievements(
  profile: Profile | undefined,
  inventory: readonly InventoryRecord[],
) {
  const { pack } = useContent();
  const { plan, contacts } = usePlan();
  const [earned, setEarned] = useState<Achievement[]>([]);
  const [standing, setStanding] = useState<AchievementSlug[]>([]);
  const [justEarned, setJustEarned] = useState<AchievementSlug[]>([]);

  const refresh = useCallback(async () => {
    setEarned(await store.achievements.all());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pack || !profile) return;

    const tier50 = new Set(
      pack.items.filter((i) => i.costTier === 'tier-50').map((i) => i.id),
    );

    const shouldHave = earnedAchievements({
      profile,
      inventory,
      items: pack.items,
      kits: pack.kits,
      plan,
      contacts,
      earned,
      tier50ItemIds: tier50,
    });

    // Standing achievements are displayed live and never persisted, so they
    // can stop being shown the moment they stop being true.
    const live = [...shouldHave].filter((slug) => STANDING_SLUGS.has(slug));
    setStanding((prev) =>
      prev.length === live.length && prev.every((s, i) => s === live[i]) ? prev : live,
    );

    const known = new Set(earned.map((a) => a.slug));
    const fresh = [...shouldHave].filter(
      (slug) => !known.has(slug) && !STANDING_SLUGS.has(slug),
    );
    if (fresh.length === 0) return;

    void (async () => {
      for (const slug of fresh) await store.achievements.award(slug);
      setJustEarned(fresh);
      await refresh();
    })();
  }, [pack, profile, inventory, plan, contacts, earned, refresh]);

  return { earned, standing, justEarned, refresh };
}
