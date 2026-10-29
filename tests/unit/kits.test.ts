import { describe, expect, it } from 'vitest';
import { COMPLETION_THRESHOLD, kitStatus, ladderWithLocks } from '@/features/supply/kits';
import type { CatalogItem, KitDefinition, KitId } from '@/content/types';
import type { InventoryRecord, Profile } from '@/db/types';

const catalog: CatalogItem[] = [
  { id: 'a', name: 'A', spec: '', category: 'tools', unit: 'each', weightG: 1000, costTier: 'tier-50', valuePerDollar: 50 },
  { id: 'b', name: 'B', spec: '', category: 'tools', unit: 'each', weightG: 2000, costTier: 'tier-50', valuePerDollar: 50 },
  { id: 'c', name: 'C', spec: '', category: 'tools', unit: 'each', weightG: 4000, costTier: 'tier-50', valuePerDollar: 50 },
  { id: 'd', name: 'D', spec: '', category: 'tools', unit: 'each', weightG: 500, costTier: 'tier-50', valuePerDollar: 50 },
  { id: 'e', name: 'E', spec: '', category: 'tools', unit: 'each', weightG: 500, costTier: 'tier-50', valuePerDollar: 50 },
];

const kit = (over: Partial<KitDefinition> = {}): KitDefinition => ({
  id: 'bob',
  name: 'Bug Out Bag',
  scenario: '',
  horizon: '',
  carriedHow: '',
  carryMode: 'back-on-foot',
  rung: 1,
  weightBudgeted: true,
  baseItems: ['a', 'b', 'c', 'd', 'e'],
  criticalItems: ['a'],
  ...over,
});

const held = (ids: string[], kitId: KitId = 'bob'): InventoryRecord[] =>
  ids.map((id) => ({
    id: `${id}-1`,
    itemId: id,
    quantity: 1,
    kits: [kitId],
    addedAt: '2026-01-01T00:00:00.000Z',
  }));

const profile: Profile = {
  id: 'self',
  members: [{ id: 'm1', label: 'You', ageBand: 'adult' }],
  pets: 0,
  hazards: [],
  targetHorizonDays: 3,
  carryFraction: 0.2,
  bodyweightKg: 70,
};

describe('kit completeness', () => {
  it('completes at 80% with all critical items, not at 100%', () => {
    expect(COMPLETION_THRESHOLD).toBe(0.8);
    const status = kitStatus(kit(), held(['a', 'b', 'c', 'd']), catalog, profile);
    expect(status.fraction).toBe(0.8);
    expect(status.complete).toBe(true);
  });

  it('is incomplete when a critical item is missing, however full it is', () => {
    // Four of five items, but the critical one is absent. A kit missing its
    // critical item is not 80% of a working kit — it is a broken kit.
    const status = kitStatus(kit(), held(['b', 'c', 'd', 'e']), catalog, profile);
    expect(status.fraction).toBe(0.8);
    expect(status.missingCritical).toEqual(['a']);
    expect(status.complete).toBe(false);
  });

  it('counts one inventory record toward every kit it belongs to', () => {
    const record: InventoryRecord = {
      id: 'a-1',
      itemId: 'a',
      quantity: 1,
      kits: ['bob', 'ghb'],
      addedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(kitStatus(kit(), [record], catalog, profile).present).toBe(1);
    expect(
      kitStatus(kit({ id: 'ghb' }), [record], catalog, profile).present,
    ).toBe(1);
  });
});

describe('carry weight budgeting', () => {
  it('budgets against a fraction of bodyweight', () => {
    const status = kitStatus(kit(), held(['a', 'b']), catalog, profile);
    expect(status.weightG).toBe(3000);
    expect(status.weightBudgetG).toBe(14_000); // 70 kg × 0.20
    expect(status.overBudgetG).toBeUndefined();
  });

  it('flags a bag nobody could carry a mile', () => {
    const heavy = kitStatus(
      kit(),
      held(['a', 'b', 'c', 'd', 'e']).map((r) => ({ ...r, quantity: 3 })),
      catalog,
      profile,
    );
    expect(heavy.weightG).toBe(24_000);
    expect(heavy.overBudgetG).toBe(10_000);
  });

  it('does not budget weight for static kits', () => {
    const home = kitStatus(kit({ weightBudgeted: false }), held(['a']), catalog, profile);
    expect(home.weightG).toBeUndefined();
  });

  it('reports weight but no budget when bodyweight is unknown', () => {
    const { bodyweightKg: _omitted, ...noWeight } = profile;
    const status = kitStatus(kit(), held(['a']), catalog, noWeight);
    expect(status.weightG).toBe(1000);
    expect(status.weightBudgetG).toBeUndefined();
  });
});

describe('the ladder', () => {
  const kits: KitDefinition[] = [
    kit({ id: 'edc', rung: 1, baseItems: ['a'], criticalItems: ['a'] }),
    kit({ id: 'ghb', rung: 2, baseItems: ['b'], criticalItems: ['b'] }),
    kit({ id: 'bob', rung: 3, baseItems: ['c'], criticalItems: ['c'] }),
  ];

  const statusesFor = (inventory: InventoryRecord[]) =>
    new Map(kits.map((k) => [k.id, kitStatus(k, inventory, catalog, profile)]));

  it('unlocks the first rung immediately — nobody starts with an INCH bag', () => {
    const ladder = ladderWithLocks(kits, statusesFor([]));
    expect(ladder[0]?.locked).toBe(false);
    expect(ladder[1]?.locked).toBe(true);
    expect(ladder[2]?.locked).toBe(true);
  });

  it('unlocks the next rung when the one below is complete', () => {
    const ladder = ladderWithLocks(kits, statusesFor(held(['a'], 'edc')));
    expect(ladder[0]?.status.complete).toBe(true);
    expect(ladder[1]?.locked).toBe(false);
    expect(ladder[2]?.locked).toBe(true);
  });

  it('names the prerequisite so the lock is explicable', () => {
    const ladder = ladderWithLocks(kits, statusesFor([]));
    expect(ladder[1]?.prerequisite?.id).toBe('edc');
  });

  it('presents rungs in ladder order regardless of input order', () => {
    const shuffled = [kits[2]!, kits[0]!, kits[1]!];
    const ladder = ladderWithLocks(shuffled, statusesFor([]));
    expect(ladder.map((l) => l.status.kit.id)).toEqual(['edc', 'ghb', 'bob']);
  });
});
