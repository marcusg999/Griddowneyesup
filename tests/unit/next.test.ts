import { describe, expect, it } from 'vitest';
import { crossesMilestone, nextMilestone, nextMove } from '@/features/supply/next';
import type { Coverage } from '@/features/supply/coverage';
import type { CatalogItem } from '@/content/types';

const cover = (resource: Coverage['resource'], stock: number, dailyNeed: number): Coverage => ({
  resource,
  stock,
  dailyNeed,
  days: dailyNeed > 0 ? stock / dailyNeed : undefined,
});

const WATER_CONTAINER: CatalogItem = {
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
};

const BOTTLED: CatalogItem = {
  ...WATER_CONTAINER,
  id: 'water-bottled-case',
  name: 'Bottled water, case',
  weightG: 12_000,
  typicalCostCents: 600,
  valuePerDollar: 40,
  provides: [{ resource: 'water-litres', perUnit: 12 }],
};

const RICE: CatalogItem = {
  ...WATER_CONTAINER,
  id: 'rice-5kg',
  name: 'Rice, 5 kg',
  category: 'food',
  unit: 'bag',
  weightG: 5_000,
  typicalCostCents: 1_200,
  valuePerDollar: 95,
  provides: [{ resource: 'calories-kcal', perUnit: 18_000 }],
};

const FUEL: CatalogItem = {
  ...WATER_CONTAINER,
  id: 'fuel-canister-230g',
  name: 'Fuel canister, 230 g',
  category: 'heat-light',
  unit: 'canister',
  weightG: 370,
  typicalCostCents: 800,
  valuePerDollar: 70,
  provides: [{ resource: 'heat-hours', perUnit: 6 }],
};

const CATALOG = [WATER_CONTAINER, BOTTLED, RICE];
/** The real catalogue serves every binding resource; this one does not. */
const WITH_HEAT = [...CATALOG, FUEL];

/** One adult: 3.785 L and 2000 kcal a day, plus sanitation. */
const adult = (waterL: number, kcal: number, uses = 500) => [
  cover('water-litres', waterL, 3.785),
  cover('calories-kcal', kcal, 2_000),
  cover('sanitation-uses', uses, 5),
];

describe('the next milestone', () => {
  it('names the next doctrine tier rather than the chosen horizon', () => {
    // A horizon of ninety days is a destination. A destination nobody is near
    // is not a goal; "three days from 72-hour readiness" is.
    expect(nextMilestone(0)).toMatchObject({ tier: '72hour', atDays: 3, daysAway: 3 });
    expect(nextMilestone(4)).toMatchObject({ tier: 'twoWeek', atDays: 14, daysAway: 10 });
    expect(nextMilestone(20)).toMatchObject({ tier: 'oneMonth', atDays: 30, daysAway: 10 });
    expect(nextMilestone(45)).toMatchObject({ tier: 'season', atDays: 90, daysAway: 45 });
  });

  it('rounds the gap up, because being a fifth of a day short is being short', () => {
    expect(nextMilestone(2.8)?.daysAway).toBe(1);
    expect(nextMilestone(13.1)?.daysAway).toBe(1);
  });

  it('returns nothing once the last milestone is passed', () => {
    expect(nextMilestone(90)).toBeUndefined();
    expect(nextMilestone(400)).toBeUndefined();
  });
});

describe('the next move', () => {
  it('is whatever runs out first, not whatever is cheapest overall', () => {
    // Three days of water, thirty of food. Water is the move.
    const move = nextMove(adult(11.355, 60_000), CATALOG, []);
    expect(move?.resource).toBe('water-litres');
    expect(move?.item.id).toBe('water-container-7gal');
  });

  it('orders by value per dollar, not by price', () => {
    // The case of bottled water is cheaper per unit and the container still
    // wins, because a dollar spent on it buys more survival (§7, D14).
    expect(nextMove(adult(11.355, 60_000), CATALOG, [])?.item.id).toBe('water-container-7gal');
  });

  it('states one unit, because the whole point is one thing to do today', () => {
    const move = nextMove(adult(11.355, 60_000), CATALOG, []);
    expect(move?.units).toBe(1);
    expect(move?.addedCostCents).toBe(2_500);
    expect(move?.addedWeightG).toBe(2_000);
  });

  it('computes the payoff in days rather than asserting it', () => {
    // 26.5 L added to 11.355 L at 3.785 L/day: three days becomes ten.
    const move = nextMove(adult(11.355, 60_000), CATALOG, []);
    expect(move?.resourceDaysNow).toBe(3);
    expect(move?.resourceDaysAfter).toBe(10);
  });

  it('says when the household number will not move as far, and why', () => {
    // Three days of water AND four days of food. Fixing water takes water to
    // nine days, but the household number stops at four, because food now
    // binds. That is the lesson, not a disappointment.
    const move = nextMove(adult(11.355, 8_000), CATALOG, []);
    expect(move?.resource).toBe('water-litres');
    expect(move?.resourceDaysAfter).toBe(10);
    expect(move?.daysNow).toBe(3);
    expect(move?.daysAfter).toBe(4);
    expect(move?.thenLimitedBy).toBe('calories-kcal');
  });

  it('does not name a next limit when the same resource still binds', () => {
    // Still short of water after one container is not a lesson; it just means
    // buy another one.
    const move = nextMove(adult(0, 10_000_000), CATALOG, []);
    expect(move?.resource).toBe('water-litres');
    expect(move?.thenLimitedBy).toBeUndefined();
  });

  it('counts heat as binding only where the household hazards make cold real', () => {
    const cold = [...adult(400, 400_000), cover('heat-hours', 0, 3)];
    // No cold hazard: heat does not bind, so the move is about something else.
    expect(nextMove(cold, WITH_HEAT, [])?.resource).not.toBe('heat-hours');
    // With one, zero hours of heat is the thing that runs out first.
    expect(nextMove(cold, WITH_HEAT, ['winter-storm'])?.resource).toBe('heat-hours');
    expect(nextMove(cold, WITH_HEAT, ['grid-down'])?.resource).toBe('heat-hours');
  });

  it('says nothing rather than redirecting when the catalogue cannot serve the limit', () => {
    // Heat binds and this catalogue has nothing for it. Offering water
    // instead would point the household away from its actual constraint,
    // which is worse than an empty card.
    const cold = [...adult(400, 400_000), cover('heat-hours', 0, 3)];
    expect(nextMove(cold, CATALOG, ['winter-storm'])).toBeUndefined();
  });

  it('survives an empty household and an empty catalogue', () => {
    expect(nextMove([], CATALOG, [])).toBeUndefined();
    expect(nextMove(adult(0, 0), [], [])).toBeUndefined();
  });

  it('ignores a resource the household needs none of', () => {
    const noPets = [...adult(400, 400_000), cover('power-wh', 0, 0)];
    expect(nextMove(noPets, CATALOG, [])?.resource).not.toBe('power-wh');
  });

  it('reports the milestone a purchase crosses, and nothing when it does not', () => {
    // Two days of water to nine crosses 72-hour readiness.
    const crossing = nextMove(adult(7.57, 60_000), CATALOG, []);
    expect(crossing?.daysNow).toBe(2);
    expect(crossesMilestone(crossing!)).toBe('72hour');

    // Already past it, and one container does not reach two weeks.
    const notCrossing = nextMove(adult(18.9, 60_000), CATALOG, []);
    expect(crossesMilestone(notCrossing!)).toBeUndefined();
  });
});
