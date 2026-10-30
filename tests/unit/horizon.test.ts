import { describe, expect, it } from 'vitest';
import {
  HORIZONS,
  horizonPlan,
  nearestHorizon,
  shortfallFor,
} from '@/features/supply/horizon';
import type { Coverage } from '@/features/supply/coverage';
import type { CatalogItem } from '@/content/types';

const coverage = (over: Partial<Coverage> = {}): Coverage => ({
  resource: 'water-litres',
  stock: 11.355, // three days for one adult
  dailyNeed: 3.785,
  days: 3,
  ...over,
});

const item = (over: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'water-container-7gal',
  name: 'Water container, 7 gallon',
  spec: 'Rigid HDPE, 26.5 L',
  category: 'water',
  unit: 'container',
  weightG: 2_000,
  typicalCostCents: 2_500,
  costTier: 'tier-200',
  valuePerDollar: 80,
  provides: [{ resource: 'water-litres', perUnit: 26.5 }],
  ...over,
});

describe('the horizons offered', () => {
  it('starts at the official three days and ends at ninety', () => {
    // Three days is where household advice stops; ninety is the number the
    // posture note says institutions plan to. The point of the control is
    // that both are on the same dial.
    expect(HORIZONS[0]).toBe(3);
    expect(HORIZONS[HORIZONS.length - 1]).toBe(90);
  });

  it('only offers numbers a household can plan against', () => {
    // Not a free-text field. "47 days" is not a goal.
    expect([...HORIZONS]).toEqual([3, 7, 21, 30, 60, 90]);
    expect([...HORIZONS]).toEqual([...HORIZONS].sort((a, b) => a - b));
  });

  it('snaps a profile carrying some other number onto the dial', () => {
    expect(nearestHorizon(3)).toBe(3);
    expect(nearestHorizon(14)).toBe(21); // 7 is 7 away, 21 is 7 away — ties go up
    expect(nearestHorizon(13)).toBe(7);
    expect(nearestHorizon(365)).toBe(90);
    expect(nearestHorizon(0)).toBe(3);
  });
});

describe('what a horizon demands', () => {
  it('multiplies the daily need, which is the whole of the maths', () => {
    const [water] = shortfallFor([coverage()], 30);
    expect(water?.required).toBeCloseTo(3.785 * 30);
    expect(water?.gap).toBeCloseTo(3.785 * 30 - 11.355);
    expect(water?.met).toBe(false);
  });

  it('reports met rather than a negative gap when there is a surplus', () => {
    const [water] = shortfallFor([coverage({ stock: 500 })], 30);
    expect(water?.gap).toBe(0);
    expect(water?.met).toBe(true);
  });

  it('calls exactly enough met, despite the division', () => {
    // 11.355 / 3.785 came back as 2.9999999999999996 days, and a tolerance of
    // a thousandth of a litre is not a lie worth worrying about.
    const [water] = shortfallFor([coverage()], 3);
    expect(water?.met).toBe(true);
  });

  it('drops a resource the household needs none of', () => {
    // A line reading "pet water: covered" for a household with no pets is how
    // a useful screen becomes a wall of text.
    expect(shortfallFor([coverage({ dailyNeed: 0, stock: 0, days: undefined })], 30)).toHaveLength(
      0,
    );
  });

  it('treats a nonsense horizon as zero rather than inverting the maths', () => {
    const [water] = shortfallFor([coverage()], -30);
    expect(water?.required).toBe(0);
    expect(water?.gap).toBe(0);
  });
});

describe('the plan to get there', () => {
  const catalog = [
    item(),
    item({
      id: 'water-bottled-case',
      name: 'Bottled water, case',
      weightG: 12_000,
      typicalCostCents: 600,
      valuePerDollar: 40,
      provides: [{ resource: 'water-litres', perUnit: 12 }],
    }),
    item({
      id: 'rice-5kg',
      name: 'Rice, 5 kg',
      category: 'food',
      unit: 'bag',
      weightG: 5_000,
      typicalCostCents: 1_200,
      valuePerDollar: 95,
      provides: [{ resource: 'calories-kcal', perUnit: 18_000 }],
    }),
  ];

  it('orders by value per dollar and nothing else', () => {
    // The sole ordering key in the app (§7, D14). The 7-gallon container wins
    // over the cheaper case of bottles because it buys more survival per
    // dollar, not because it is cheaper or lighter.
    const plan = horizonPlan([coverage()], catalog, 30);
    expect(plan.buy).toHaveLength(1);
    expect(plan.buy[0]?.item.id).toBe('water-container-7gal');
  });

  it('rounds units up, because a litre short of ninety days is not ninety days', () => {
    const plan = horizonPlan([coverage()], catalog, 30);
    // 113.55 litres required, 11.355 held, 102.195 short, 26.5 per container.
    expect(plan.buy[0]?.units).toBe(4);
  });

  it('counts the weight, which is the part that surprises people', () => {
    const plan = horizonPlan([coverage()], catalog, 30);
    expect(plan.totalWeightG).toBe(4 * 2_000);
  });

  it('keeps the priced-line count so a partial total is never shown as the whole', () => {
    const unpriced = [item({ typicalCostCents: undefined, valuePerDollar: 99 })];
    const plan = horizonPlan([coverage()], unpriced, 30);
    expect(plan.buy).toHaveLength(1);
    expect(plan.totalCostCents).toBe(0);
    expect(plan.pricedLines).toBe(0);
  });

  it('says nothing rather than guessing when the catalog cannot close a gap', () => {
    const plan = horizonPlan(
      [coverage({ resource: 'power-wh', stock: 0, dailyNeed: 60, days: 0 })],
      catalog,
      30,
    );
    expect(plan.buy).toHaveLength(0);
    expect(plan.shortfalls[0]?.met).toBe(false);
  });

  it('reports met when there is nothing to buy', () => {
    const plan = horizonPlan([coverage({ stock: 10_000 })], catalog, 90);
    expect(plan.met).toBe(true);
    expect(plan.buy).toEqual([]);
  });

  it('grows the bill with the horizon, which is the point of the control', () => {
    const three = horizonPlan([coverage()], catalog, 3);
    const ninety = horizonPlan([coverage()], catalog, 90);
    expect(three.met).toBe(true);
    expect(ninety.totalWeightG).toBeGreaterThan(20_000);
    expect(ninety.totalCostCents).toBeGreaterThan(three.totalCostCents);
  });

  it('plans every unmet resource, not only the binding one', () => {
    const plan = horizonPlan(
      [coverage(), coverage({ resource: 'calories-kcal', stock: 0, dailyNeed: 2_000, days: 0 })],
      catalog,
      30,
    );
    expect(plan.buy.map((line) => line.resource)).toEqual(['water-litres', 'calories-kcal']);
  });
});
