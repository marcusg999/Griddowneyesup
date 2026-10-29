import { describe, expect, it } from 'vitest';
import { acquisitionPath, orderByValue } from '@/features/supply/recommend';
import {
  attachOffers,
  freshOffers,
  mayShowOffers,
  COMMERCE_FORBIDDEN_SURFACES,
} from '@/features/commerce/offers';
import type { CatalogItem, Offer } from '@/content/types';

/**
 * §14: "disclosure is mandatory and it must never reorder a recommendation.
 * Decide this now — retrofitting integrity is impossible."
 *
 * These are the tests that make that a fact about the code rather than a
 * sentence in a policy file.
 */

const item = (
  id: string,
  valuePerDollar: number,
  costTier: CatalogItem['costTier'] = 'tier-50',
  typicalCostCents = 1000,
): CatalogItem => ({
  id,
  name: id,
  spec: 'spec',
  category: 'tools',
  unit: 'each',
  weightG: 100,
  costTier,
  valuePerDollar,
  typicalCostCents,
});

const items: CatalogItem[] = [
  item('water', 98),
  item('filter', 95),
  item('torch', 94),
  item('stove', 80, 'tier-200', 4000),
  item('radio', 82, 'tier-200', 3000),
];

const offer = (id: string, itemId: string, affiliate: boolean, asOf: string): Offer => ({
  id,
  itemId,
  merchant: 'Merchant',
  url: 'https://example.com/x',
  affiliate,
  asOf,
});

describe('recommendation ordering', () => {
  it('orders by marginal survival value per dollar, cheapest tier first', () => {
    expect(orderByValue(items).map((i) => i.id)).toEqual([
      'water',
      'filter',
      'torch',
      'radio',
      'stove',
    ]);
  });

  it('is stable and total, so the no-reorder test is meaningful', () => {
    const tied = [item('b', 90), item('a', 90)];
    expect(orderByValue(tied).map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('commerce cannot reorder a recommendation', () => {
  it('attaching offers leaves the order byte-identical', () => {
    // The §14 constraint, stated as an assertion: stripping all affiliate
    // data must leave recommendation order unchanged.
    const ordered = orderByValue(items);
    const heavilyOffered = [
      offer('o1', 'stove', true, '2026-10-29'),
      offer('o2', 'stove', true, '2026-10-29'),
      offer('o3', 'radio', true, '2026-10-29'),
    ];

    const withCommerce = attachOffers(ordered, heavilyOffered).map((d) => d.subject.id);
    const without = attachOffers(ordered, []).map((d) => d.subject.id);

    expect(withCommerce).toEqual(without);
    expect(withCommerce).toEqual(ordered.map((i) => i.id));
    expect(JSON.stringify(withCommerce)).toBe(JSON.stringify(without));
  });

  it('the acquisition path is identical whether or not offers exist', () => {
    const held = new Set<string>();
    const path = acquisitionPath(items, held);
    const ids = path.map((t) => t.items.map((i) => i.id));

    // Offers exist only downstream of this call, and the function has no
    // parameter through which they could arrive.
    expect(ids).toEqual(acquisitionPath(items, held).map((t) => t.items.map((i) => i.id)));
    expect(ids[0]).toEqual(['water', 'filter', 'torch']);
  });

  it('an affiliate offer does not outrank a non-affiliate one', () => {
    const ordered = orderByValue(items);
    const paidOnLowValue = [offer('paid', 'stove', true, '2026-10-29')];
    expect(attachOffers(ordered, paidOnLowValue).map((d) => d.subject.id)).toEqual(
      ordered.map((i) => i.id),
    );
  });
});

describe('stale offers', () => {
  const now = new Date('2026-10-29T00:00:00Z');

  it('keeps a recently checked offer', () => {
    expect(freshOffers([offer('o', 'water', true, '2026-10-01')], now)).toHaveLength(1);
  });

  it('drops an offer nobody has checked in months', () => {
    // A dead link or a wrong price on a preparedness list is worse than no
    // link, and it is the kind of rot that nobody notices.
    expect(freshOffers([offer('o', 'water', true, '2026-06-01')], now)).toHaveLength(0);
  });

  it('dropping stale offers still does not change the order', () => {
    const ordered = orderByValue(items);
    const stale = [offer('o', 'water', true, '2020-01-01')];
    expect(attachOffers(ordered, stale, now).map((d) => d.subject.id)).toEqual(
      ordered.map((i) => i.id),
    );
  });
});

describe('surfaces where commerce is forbidden', () => {
  it('allows offers on acquisition surfaces', () => {
    expect(mayShowOffers('acquisition')).toBe(true);
    expect(mayShowOffers('supplies')).toBe(true);
  });

  it.each(COMMERCE_FORBIDDEN_SURFACES)('refuses offers on the %s surface', (surface) => {
    // Pairing a price shock or a threat signal with a buy button is fear as a
    // conversion mechanic, which §6 forbids outright.
    expect(mayShowOffers(surface)).toBe(false);
  });
});

describe('nothing vanishes from the acquisition path', () => {
  it('rolls an item that does not fit a tier forward instead of dropping it', () => {
    // Found by a failing offline test: a $25 filter disappeared entirely
    // because a $30 toilet kit had already spent the $50 budget. An item
    // silently vanishing from a preparedness list is the worst failure this
    // function has available to it.
    const tight: CatalogItem[] = [
      item('toilet', 96, 'tier-50', 3_000),
      item('filter', 95, 'tier-50', 2_500),
      item('water', 98, 'tier-50', 150),
    ];
    const path = acquisitionPath(tight, new Set());
    const listed = path.flatMap((t) => t.items.map((i) => i.id));

    expect(listed).toContain('filter');
    expect(new Set(listed).size).toBe(tight.length);
  });

  it('every needed item appears exactly once across the whole path', () => {
    const path = acquisitionPath(items, new Set(['torch']));
    const listed = path.flatMap((t) => t.items.map((i) => i.id));
    expect(listed).not.toContain('torch');
    expect(listed.sort()).toEqual(['filter', 'radio', 'stove', 'water'].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe('suppression is absence, not invisibility', () => {
  it('refuses to build offer rows for a forbidden surface', () => {
    // Found by a failing offline test: Grey Sky hid offers with CSS, which
    // left every purchase link sitting in the document. A link that is merely
    // invisible is still a link.
    expect(mayShowOffers('grey-sky')).toBe(false);
  });
});
