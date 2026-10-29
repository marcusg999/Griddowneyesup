import { describe, expect, it } from 'vitest';
import { expiredCount, rotationQueue, suggestedExpiry } from '@/features/supply/rotation';
import type { CatalogItem } from '@/content/types';
import type { InventoryRecord } from '@/db/types';

const now = new Date('2026-10-29T00:00:00Z');

const catalog: CatalogItem[] = [
  {
    id: 'water',
    name: 'Stored drinking water',
    spec: '1 gallon',
    category: 'water',
    unit: 'gallon',
    weightG: 3785,
    costTier: 'tier-50',
    valuePerDollar: 98,
    shelfLifeDays: 180,
  },
  {
    id: 'tape',
    name: 'Duct tape',
    spec: 'roll',
    category: 'tools',
    unit: 'roll',
    weightG: 300,
    costTier: 'tier-50',
    valuePerDollar: 76,
  },
];

const rec = (id: string, itemId: string, expiresOn?: string, quantity = 1): InventoryRecord => ({
  id,
  itemId,
  quantity,
  kits: ['home'],
  addedAt: '2026-01-01T00:00:00.000Z',
  ...(expiresOn ? { expiresOn } : {}),
});

describe('rotation queue', () => {
  it('ignores items with no expiry', () => {
    expect(rotationQueue([rec('a', 'tape')], catalog, now)).toHaveLength(0);
  });

  it('buckets by how soon, soonest first', () => {
    const q = rotationQueue(
      [
        rec('c', 'water', '2026-12-20'),
        rec('a', 'water', '2026-10-01'),
        rec('b', 'water', '2026-11-10'),
      ],
      catalog,
      now,
    );
    expect(q.map((e) => e.bucket)).toEqual(['expired', 'this-month', 'this-quarter']);
    expect(q[0]!.daysRemaining).toBeLessThan(0);
  });

  it('does not nag about something a year out', () => {
    expect(rotationQueue([rec('a', 'water', '2027-10-01')], catalog, now)).toHaveLength(0);
  });

  it('ignores stock the household no longer has', () => {
    expect(rotationQueue([rec('a', 'water', '2026-10-01', 0)], catalog, now)).toHaveLength(0);
  });

  it('counts expired items', () => {
    expect(
      expiredCount([rec('a', 'water', '2026-10-01'), rec('b', 'water', '2026-12-01')], now),
    ).toBe(1);
  });
});

describe('suggested expiry', () => {
  it('offers a date from the catalog shelf life', () => {
    expect(suggestedExpiry(catalog[0], now)).toBe('2027-04-27');
  });

  it('offers nothing for an item that does not expire', () => {
    expect(suggestedExpiry(catalog[1], now)).toBeUndefined();
  });
});
