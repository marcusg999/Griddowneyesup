import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedAchievements } from '@/features/supply/achievements';
import type { AchievementInputs } from '@/features/supply/achievements';
import type { CatalogItem, KitDefinition } from '@/content/types';
import type { InventoryRecord, Profile } from '@/db/types';
import { EMPTY_PLAN, type Contact } from '@/features/plan/types';

const now = new Date('2026-10-29T00:00:00Z');

const items: CatalogItem[] = [
  {
    id: 'water',
    name: 'Water',
    spec: '1 gal',
    category: 'water',
    unit: 'gallon',
    weightG: 3785,
    costTier: 'tier-50',
    valuePerDollar: 98,
    provides: [{ resource: 'water-litres', perUnit: 3.785 }],
  },
  {
    id: 'food',
    name: 'Food',
    spec: 'day',
    category: 'food',
    unit: 'person-day',
    weightG: 900,
    costTier: 'tier-50',
    valuePerDollar: 92,
    provides: [{ resource: 'calories-kcal', perUnit: 2000 }],
  },
  {
    id: 'bucket',
    name: 'Twin-bucket toilet',
    spec: 'two buckets',
    category: 'sanitation',
    unit: 'each',
    weightG: 2500,
    costTier: 'tier-50',
    valuePerDollar: 96,
    provides: [{ resource: 'sanitation-uses', perUnit: 60 }],
  },
  {
    id: 'hatchet',
    name: 'Hatchet',
    spec: 'heavy',
    category: 'tools',
    unit: 'each',
    weightG: 20_000,
    costTier: 'tier-200',
    valuePerDollar: 40,
  },
];

const bob: KitDefinition = {
  id: 'bob',
  name: 'Bug Out Bag',
  scenario: '',
  horizon: '',
  carriedHow: '',
  carryMode: 'back-on-foot',
  rung: 5,
  weightBudgeted: true,
  baseItems: ['water', 'hatchet'],
  criticalItems: ['water'],
};

const profile: Profile = {
  id: 'self',
  members: [{ id: 'm1', label: 'You', ageBand: 'adult' }],
  pets: 0,
  hazards: [],
  targetHorizonDays: 3,
  carryFraction: 0.2,
  bodyweightKg: 70,
};

const rec = (
  itemId: string,
  quantity: number,
  over: Partial<InventoryRecord> = {},
): InventoryRecord => ({
  id: `${itemId}-${quantity}-${over.expiresOn ?? 'x'}`,
  itemId,
  quantity,
  kits: ['home'],
  addedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const base = (over: Partial<AchievementInputs> = {}): AchievementInputs => ({
  profile,
  inventory: [],
  items,
  kits: [bob],
  plan: EMPTY_PLAN,
  contacts: [],
  earned: [],
  tier50ItemIds: new Set(['water', 'food', 'bucket']),
  now,
  ...over,
});

describe('achievement definitions', () => {
  it('every slug is unique', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.slug)).size).toBe(ACHIEVEMENTS.length);
  });

  it('none of them reward opening the app', () => {
    // D16's governing rule. Cold Start is the edge case and survives it: the
    // user had to turn the network off, which is a real-world act.
    const forbidden = /streak|visit|open the app|log in|daily|session/i;
    for (const a of ACHIEVEMENTS) {
      expect(`${a.name} ${a.note}`, a.slug).not.toMatch(forbidden);
    }
  });
});

describe('earning', () => {
  it('earns nothing from an empty household', () => {
    expect(earnedAchievements(base()).size).toBe(0);
  });

  it('earns Out of Area for a contact outside the region with a number', () => {
    const contact: Contact = { id: 'c', name: 'Ruth', outOfArea: true, phone: '555' };
    expect(earnedAchievements(base({ contacts: [contact] }))).toContain('out-of-area');
  });

  it('does not earn Out of Area for a contact with no number', () => {
    const contact: Contact = { id: 'c', name: 'Ruth', outOfArea: true };
    expect(earnedAchievements(base({ contacts: [contact] }))).not.toContain('out-of-area');
  });

  it('earns Shutoff Certified only when all three are located', () => {
    const two = { ...EMPTY_PLAN, gas: { location: 'side' }, water: { location: 'cellar' } };
    expect(earnedAchievements(base({ plan: two }))).not.toContain('shutoff-certified');
    const three = { ...two, electric: { location: 'garage' } };
    expect(earnedAchievements(base({ plan: three }))).toContain('shutoff-certified');
  });

  it('earns 72 Hours at three days of everything, not of one thing', () => {
    // Water alone is not coverage; the binding constraint is what counts.
    const waterOnly = earnedAchievements(base({ inventory: [rec('water', 10)] }));
    expect(waterOnly).not.toContain('seventy-two');

    // Sanitation binds too: the brief is right that it is the leading cause
    // of illness in a prolonged outage and the thing households skip.
    const both = earnedAchievements(
      base({ inventory: [rec('water', 10), rec('food', 10), rec('bucket', 1)] }),
    );
    expect(both).toContain('seventy-two');
    expect(both).not.toContain('two-week');
  });

  it('earns Two Weeks at fourteen days', () => {
    const earned = earnedAchievements(
      base({ inventory: [rec('water', 40), rec('food', 40), rec('bucket', 2)] }),
    );
    expect(earned).toContain('two-week');
    expect(earned).toContain('seventy-two');
  });

  it('earns Fifty Dollars In only when every tier-50 item is held', () => {
    expect(earnedAchievements(base({ inventory: [rec('water', 1)] }))).not.toContain(
      'fifty-dollars-in',
    );
    expect(
      earnedAchievements(
        base({ inventory: [rec('water', 1), rec('food', 1), rec('bucket', 1)] }),
      ),
    ).toContain('fifty-dollars-in');
  });

  it('earns Under Budget only for a bag that is both packed and within the limit', () => {
    // An empty bag is trivially under budget and is not an achievement.
    expect(earnedAchievements(base())).not.toContain('under-budget');

    const light = rec('water', 1, { kits: ['bob'] });
    expect(earnedAchievements(base({ inventory: [light] }))).toContain('under-budget');

    const heavy = rec('hatchet', 1, { kits: ['bob'] });
    expect(earnedAchievements(base({ inventory: [light, heavy] }))).not.toContain(
      'under-budget',
    );
  });

  it('earns Nothing Expired only once something has a date on it', () => {
    // An inventory with no dates has not demonstrated rotation.
    expect(earnedAchievements(base({ inventory: [rec('water', 1)] }))).not.toContain(
      'rotation-clear',
    );
    const dated = rec('water', 1, { expiresOn: '2027-01-01' });
    expect(earnedAchievements(base({ inventory: [dated] }))).toContain('rotation-clear');
    const stale = rec('food', 1, { expiresOn: '2026-01-01' });
    expect(earnedAchievements(base({ inventory: [dated, stale] }))).not.toContain(
      'rotation-clear',
    );
  });

  it('never takes a milestone back', () => {
    // Policy G06: a milestone records something that happened and stays made
    // even when the condition that earned it no longer holds. Standing
    // achievements are different — see below.
    const earned = earnedAchievements(
      base({
        inventory: [],
        earned: [{ slug: 'seventy-two', earnedAt: '2026-01-01T00:00:00.000Z' }],
      }),
    );
    expect(earned).toContain('seventy-two');
  });
});

describe('standing versus milestone', () => {
  it('stops claiming Nothing Expired once something expires', () => {
    // Found by looking at a screenshot: the badge was displayed directly
    // above a rotation queue listing bleach twenty days past its date. A
    // badge that lies costs more trust than it ever bought.
    const expired = rec('food', 1, { expiresOn: '2026-01-01' });
    const earned = earnedAchievements(
      base({
        inventory: [expired],
        earned: [{ slug: 'rotation-clear', earnedAt: '2026-05-01T00:00:00.000Z' }],
      }),
    );
    expect(earned).not.toContain('rotation-clear');
  });

  it('stops claiming Under Budget once the bag goes over', () => {
    const earned = earnedAchievements(
      base({
        inventory: [rec('hatchet', 1, { kits: ['bob'] })],
        earned: [{ slug: 'under-budget', earnedAt: '2026-05-01T00:00:00.000Z' }],
      }),
    );
    expect(earned).not.toContain('under-budget');
  });

  it('still keeps a milestone that records something that happened', () => {
    // Reaching 72 hours once is a historical fact. Policy G06 protects it.
    const earned = earnedAchievements(
      base({
        inventory: [],
        earned: [{ slug: 'seventy-two', earnedAt: '2026-01-01T00:00:00.000Z' }],
      }),
    );
    expect(earned).toContain('seventy-two');
  });
});
