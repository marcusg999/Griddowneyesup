import type { CatalogItem, ResourceKind } from '@/content/types';
import type { Coverage } from './coverage';

/**
 * The horizon, and what changing it costs.
 *
 * Coverage answers "how many days am I good for". This answers the question
 * that follows and is harder to face: "what would it take to be good for
 * ninety". Same inventory, same daily needs, a different multiplier — and the
 * output is not a percentage but a count of things to buy, what they weigh
 * and roughly what they cost.
 *
 * Why that framing. The standing household advice is 72 hours, and the
 * posture note (§9) points out that the institutions planning for the same
 * events plan in months. Arguing with that gap is only useful if a reader can
 * see what closing it actually involves. A household that discovers ninety
 * days of water is a quarter of a tonne has learned something true, and
 * learned it before an emergency rather than during one.
 *
 * So this is deliberately not reassuring. It does not round the weight down,
 * it does not hide the cost, and it does not pretend a horizon is a setting
 * you can simply select.
 */

/**
 * The horizons offered. Three days is where the official advice stops and is
 * the default; the rest are the steps a household actually thinks in — a
 * week, three weeks, a month, two, a season.
 *
 * Not a free-text field. A number nobody can plan against is not a goal, and
 * "47 days" is a number nobody can plan against.
 */
export const HORIZONS: readonly number[] = [3, 7, 21, 30, 60, 90];

export const DEFAULT_HORIZON_DAYS = 3;

/**
 * The nearest offered horizon, for a profile carrying some other number.
 *
 * Ties go up — `<=` against an ascending list. Fourteen days is equidistant
 * from seven and twenty-one, and rounding it down would quietly halve
 * somebody's target. In the one direction that matters, over-preparing is a
 * cost and under-preparing is the thing this app exists to prevent.
 */
export function nearestHorizon(days: number): number {
  return HORIZONS.reduce((best, h) =>
    Math.abs(h - days) <= Math.abs(best - days) ? h : best,
  );
}

export interface Shortfall {
  readonly resource: ResourceKind;
  readonly dailyNeed: number;
  readonly stock: number;
  /** What the horizon demands: daily need × days. */
  readonly required: number;
  /** What is missing. Zero when the horizon is already met. */
  readonly gap: number;
  /** Days this resource currently covers, or undefined when none is needed. */
  readonly daysCovered: number | undefined;
  readonly met: boolean;
}

/**
 * What a horizon demands, per resource.
 *
 * Resources the household needs none of are dropped rather than reported as
 * met: a household with no pets does not need a "pet water: covered" line,
 * and a list of things that do not apply to you is how a useful screen
 * becomes a wall of text.
 */
export function shortfallFor(
  coverage: readonly Coverage[],
  horizonDays: number,
): readonly Shortfall[] {
  const days = Math.max(0, horizonDays);

  return coverage
    .filter((entry) => entry.dailyNeed > 0)
    .map((entry) => {
      const required = entry.dailyNeed * days;
      const gap = Math.max(0, required - entry.stock);
      return {
        resource: entry.resource,
        dailyNeed: entry.dailyNeed,
        stock: entry.stock,
        required,
        gap,
        daysCovered: entry.days,
        // A hair under is not met. Floating-point division produced 2.9999
        // days of water from exactly three days of stock, and a tolerance of
        // a thousandth of a litre is not a lie worth worrying about.
        met: gap < 1e-3,
      };
    });
}

export interface BuyLine {
  readonly resource: ResourceKind;
  readonly item: CatalogItem;
  /** Whole units. You cannot buy 2.3 jerrycans. */
  readonly units: number;
  readonly addedWeightG: number;
  /** Undefined when the catalog has no typical cost for this item. */
  readonly addedCostCents: number | undefined;
}

export interface HorizonPlan {
  readonly horizonDays: number;
  readonly shortfalls: readonly Shortfall[];
  readonly buy: readonly BuyLine[];
  readonly totalWeightG: number;
  /**
   * Total of the lines that have a price. Deliberately separate from
   * `pricedLines`, so a partial total is never presented as the whole cost.
   */
  readonly totalCostCents: number;
  readonly pricedLines: number;
  /** True when nothing needs buying — the horizon is already met. */
  readonly met: boolean;
}

/**
 * The cheapest honest way to close each gap.
 *
 * Ordered by `valuePerDollar` and nothing else, which is the rule the content
 * policy sets for every recommendation in the app (§7, D14): marginal
 * survival value per dollar is the sole ordering key, and commerce data may
 * only ever be joined on afterwards. One item per resource, because a gap
 * closed by seven different products is a shopping list nobody follows.
 */
export function horizonPlan(
  coverage: readonly Coverage[],
  catalog: readonly CatalogItem[],
  horizonDays: number,
): HorizonPlan {
  const shortfalls = shortfallFor(coverage, horizonDays);
  const buy: BuyLine[] = [];

  for (const shortfall of shortfalls) {
    if (shortfall.met) continue;

    const candidates = catalog
      .filter((item) =>
        (item.provides ?? []).some(
          (contribution) => contribution.resource === shortfall.resource && contribution.perUnit > 0,
        ),
      )
      .sort((a, b) => b.valuePerDollar - a.valuePerDollar);

    const item = candidates[0];
    if (!item) continue; // Nothing in the catalog provides it. Say nothing rather than guess.

    const perUnit = (item.provides ?? []).find(
      (contribution) => contribution.resource === shortfall.resource,
    )?.perUnit;
    if (!perUnit) continue;

    // Rounded up: a plan that leaves you a litre short at day ninety has not
    // reached day ninety.
    const units = Math.ceil(shortfall.gap / perUnit);
    buy.push({
      resource: shortfall.resource,
      item,
      units,
      addedWeightG: units * item.weightG,
      addedCostCents:
        item.typicalCostCents === undefined ? undefined : units * item.typicalCostCents,
    });
  }

  const priced = buy.filter((line) => line.addedCostCents !== undefined);

  return {
    horizonDays,
    shortfalls,
    buy,
    totalWeightG: buy.reduce((sum, line) => sum + line.addedWeightG, 0),
    totalCostCents: priced.reduce((sum, line) => sum + (line.addedCostCents ?? 0), 0),
    pricedLines: priced.length,
    met: buy.length === 0,
  };
}
