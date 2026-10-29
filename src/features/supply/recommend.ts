import type { CatalogItem, CostTier } from '@/content/types';

/**
 * Recommendation ordering. §4.2, §14.
 *
 * THIS MODULE CANNOT SEE COMMERCE DATA, and that is the entire point.
 *
 * It imports no offer type, takes no merchant argument, and has no parameter
 * through which a commission could reach it. "Affiliate links never reorder a
 * recommendation" is therefore a property of the module graph rather than a
 * promise in a policy document — the only way to break it is to add an import
 * that review and the test suite would both catch.
 *
 * Ordering key is marginal survival value per dollar, exactly as §4.2 says.
 */

const TIER_ORDER: Record<CostTier, number> = {
  'tier-50': 0,
  'tier-200': 1,
  'tier-500': 2,
  beyond: 3,
};

/**
 * Orders items by what a dollar buys you, cheapest tier first.
 *
 * Within a tier, higher survival value per dollar comes first; ties break on
 * id so the order is total and stable. A stable order is what makes the
 * "commerce changes nothing" test meaningful.
 */
export function orderByValue(items: readonly CatalogItem[]): readonly CatalogItem[] {
  return [...items].sort((a, b) => {
    const tier = TIER_ORDER[a.costTier] - TIER_ORDER[b.costTier];
    if (tier !== 0) return tier;
    const value = b.valuePerDollar - a.valuePerDollar;
    if (value !== 0) return value;
    return a.id.localeCompare(b.id);
  });
}

/**
 * The cost-staged acquisition path (§4.2): what $50 buys you, then $200, then
 * $500 — so a broke user gets a real path instead of a shopping fantasy.
 */
export interface AcquisitionTier {
  readonly tier: CostTier;
  readonly label: string;
  readonly budgetCents: number;
  readonly items: readonly CatalogItem[];
  readonly spendCents: number;
}

const TIERS: ReadonlyArray<{ tier: CostTier; label: string; budgetCents: number }> = [
  { tier: 'tier-50', label: 'The first $50', budgetCents: 5_000 },
  { tier: 'tier-200', label: 'The next $150', budgetCents: 15_000 },
  { tier: 'tier-500', label: 'The next $300', budgetCents: 30_000 },
];

/**
 * Builds the tiers from items the household does not already hold.
 *
 * Greedy within each budget, in value-per-dollar order. Items without a price
 * are included and counted as zero, because "we do not know what this costs"
 * is not a reason to leave a water filter off the list.
 *
 * Anything that does not fit a tier ROLLS FORWARD to the next one rather than
 * being dropped. An earlier version silently discarded it, which meant a $25
 * water filter could disappear from the list entirely because a $30 toilet
 * kit had already used the budget — a item vanishing from a preparedness
 * list is the worst possible failure mode for this function.
 */
export function acquisitionPath(
  items: readonly CatalogItem[],
  heldItemIds: ReadonlySet<string>,
): readonly AcquisitionTier[] {
  const needed = orderByValue(items.filter((i) => !heldItemIds.has(i.id)));
  let carried: CatalogItem[] = [];

  return TIERS.map(({ tier, label, budgetCents }, index) => {
    const isLast = index === TIERS.length - 1;
    const candidates = orderByValue([
      ...carried,
      ...needed.filter((i) => i.costTier === tier),
    ]);

    const chosen: CatalogItem[] = [];
    const deferred: CatalogItem[] = [];
    let spend = 0;

    for (const item of candidates) {
      const cost = item.typicalCostCents ?? 0;
      if (!isLast && spend + cost > budgetCents && chosen.length > 0) {
        deferred.push(item);
        continue;
      }
      chosen.push(item);
      spend += cost;
    }

    carried = deferred;
    return { tier, label, budgetCents, items: chosen, spendCents: spend };
  });
}
