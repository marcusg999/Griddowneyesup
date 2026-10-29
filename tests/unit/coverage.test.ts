import { describe, expect, it } from 'vitest';
import {
  computeCoverage,
  dailyNeeds,
  limitingDays,
  tierFor,
  wholeDays,
} from '@/features/supply/coverage';
import type { CatalogItem } from '@/content/types';
import type { InventoryRecord, Profile } from '@/db/types';

const oneAdult: Profile = {
  id: 'self',
  members: [{ id: 'm1', label: 'You', ageBand: 'adult' }],
  pets: 0,
  hazards: [],
  targetHorizonDays: 3,
  carryFraction: 0.2,
};

const catalog: CatalogItem[] = [
  {
    id: 'water-stored-gal',
    name: 'Stored drinking water',
    spec: '1 gallon',
    category: 'water',
    unit: 'gallon',
    weightG: 3785,
    costTier: 'tier-50',
    valuePerDollar: 98,
    provides: [{ resource: 'water-litres', perUnit: 3.785 }],
  },
  {
    id: 'food-day',
    name: 'Shelf-stable food',
    spec: '2000 kcal',
    category: 'food',
    unit: 'person-day',
    weightG: 900,
    costTier: 'tier-50',
    valuePerDollar: 92,
    provides: [{ resource: 'calories-kcal', perUnit: 2000 }],
  },
];

const record = (itemId: string, quantity: number, expiresOn?: string): InventoryRecord => ({
  id: `${itemId}-1`,
  itemId,
  quantity,
  kits: ['home'],
  addedAt: '2026-01-01T00:00:00.000Z',
  ...(expiresOn ? { expiresOn } : {}),
});

describe('daily needs', () => {
  it('uses the federal one-gallon-per-person-per-day figure', () => {
    expect(dailyNeeds(oneAdult)['water-litres']).toBeCloseTo(3.785, 3);
  });

  it('scales with household size', () => {
    const twoAdults: Profile = {
      ...oneAdult,
      members: [...oneAdult.members, { id: 'm2', label: 'Partner', ageBand: 'adult' }],
    };
    expect(dailyNeeds(twoAdults)['water-litres']).toBeCloseTo(7.57, 2);
  });

  it('counts pets, which plans routinely forget', () => {
    expect(dailyNeeds({ ...oneAdult, pets: 2 })['water-litres']).toBeCloseTo(5.785, 3);
  });
});

describe('coverage', () => {
  it('expresses stock as days, not as items owned', () => {
    const coverage = computeCoverage(oneAdult, [record('water-stored-gal', 4)], catalog);
    const water = coverage.find((c) => c.resource === 'water-litres');
    expect(wholeDays(water?.days)).toBe(4);
  });

  it('ignores expired stock, because expired stock is not stock', () => {
    const coverage = computeCoverage(
      oneAdult,
      [record('food-day', 10, '2020-01-01')],
      catalog,
    );
    expect(coverage.find((c) => c.resource === 'calories-kcal')?.stock).toBe(0);
  });

  it('counts stock that has not expired yet', () => {
    const coverage = computeCoverage(
      oneAdult,
      [record('food-day', 10, '2099-01-01')],
      catalog,
    );
    expect(coverage.find((c) => c.resource === 'calories-kcal')?.stock).toBe(20_000);
  });

  it('reports water before calories, because it is always water', () => {
    const coverage = computeCoverage(oneAdult, [], catalog);
    expect(coverage[0]?.resource).toBe('water-litres');
  });
});

describe('limiting days', () => {
  it('takes the resource that runs out first, not the average', () => {
    // Ninety days of rice and two days of water is two days of coverage.
    // Averaging would say forty-six, which would be flattering and useless.
    const coverage = computeCoverage(
      oneAdult,
      [record('water-stored-gal', 2), record('food-day', 90)],
      catalog,
    );
    expect(Math.floor(limitingDays(coverage))).toBe(0);
  });

  it('is zero for an empty household', () => {
    expect(limitingDays(computeCoverage(oneAdult, [], catalog))).toBe(0);
  });
});

describe('readiness tiers', () => {
  it('maps to real doctrine rather than invented levels', () => {
    expect(tierFor(0)).toBe('unprepared');
    expect(tierFor(2.9)).toBe('unprepared');
    expect(tierFor(3)).toBe('72hour');
    expect(tierFor(14)).toBe('twoWeek');
    expect(tierFor(30)).toBe('oneMonth');
    expect(tierFor(90)).toBe('season');
  });

  it('rounds days down, because 3.9 days of water is 3 days of water', () => {
    expect(wholeDays(3.9)).toBe(3);
    expect(wholeDays(undefined)).toBe(0);
  });
});
