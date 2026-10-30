import type { CatalogItem, HazardId, ResourceKind } from '@/content/types';
import { bindingResourcesFor, limitingDays, tierFor, type Coverage, type ReadinessTier } from './coverage';

/**
 * The next move, and the next milestone.
 *
 * This is the app's answer to "gamify it". D16 forbids the obvious version:
 * no mechanic may reward app usage, and a score that rises because somebody
 * opened a screen is measuring the wrong thing. So there are no points, no
 * streaks, no levels and nothing to collect.
 *
 * What is left turns out to be better, because it was already in the data.
 * Coverage is measured in days. Every catalogue item states what it provides
 * per unit and what it typically costs. Divide one by the other and you get
 * the only sentence that has ever made anybody buy a water container:
 *
 *   "$25 and two kilograms takes you from four days to eleven."
 *
 * That is a game loop. It has a score you cannot fake, a single clear move,
 * a visible payoff, and a named goal — and every part of it is a physical
 * claim the user could check in their own cupboard.
 *
 * The binding constraint supplies the move. You are not "63% prepared"; you
 * are limited by water, so water is the move, and when water stops being the
 * limit the move changes on its own. That is also the one genuinely
 * interesting idea in household preparedness, and playing it teaches it
 * better than explaining it would.
 */

/** Milestones named after real doctrine, so reaching one means something. */
const TIER_AT: readonly { readonly tier: ReadinessTier; readonly days: number }[] = [
  { tier: '72hour', days: 3 },
  { tier: 'twoWeek', days: 14 },
  { tier: 'oneMonth', days: 30 },
  { tier: 'season', days: 90 },
];

export interface Milestone {
  readonly tier: ReadinessTier;
  readonly atDays: number;
  /** Whole days still needed. Always at least 1 — zero would mean arrived. */
  readonly daysAway: number;
}

/**
 * The next milestone above where the household is now, or undefined once the
 * last one is passed.
 *
 * Deliberately the next one rather than the chosen horizon: a horizon of
 * ninety days is a destination, and a destination nobody is near is not a
 * goal. "Three days from 72-hour readiness" is.
 */
export function nextMilestone(days: number): Milestone | undefined {
  const target = TIER_AT.find((t) => days < t.days);
  if (!target) return undefined;
  return {
    tier: target.tier,
    atDays: target.days,
    // Rounded up: being 0.2 days short is still being short.
    daysAway: Math.max(1, Math.ceil(target.days - days)),
  };
}

export interface NextMove {
  /** The resource that runs out first, which is what makes this the move. */
  readonly resource: ResourceKind;
  readonly item: CatalogItem;
  readonly units: number;
  readonly addedWeightG: number;
  readonly addedCostCents: number | undefined;
  /** Household coverage now, in whole days. */
  readonly daysNow: number;
  /** Household coverage after this purchase, in whole days. */
  readonly daysAfter: number;
  /** Days of THIS resource now and after, which is always the bigger jump. */
  readonly resourceDaysNow: number;
  readonly resourceDaysAfter: number;
  /**
   * Set when the household number does not move as far as this resource does,
   * because something else becomes the limit. Named, because "you fixed water
   * and now food is the constraint" is the lesson rather than a disappointment.
   */
  readonly thenLimitedBy: ResourceKind | undefined;
}

/** Days of a single resource, floored. Undefined need means not applicable. */
function daysOf(entry: Coverage | undefined): number {
  if (!entry || entry.dailyNeed <= 0) return 0;
  return entry.stock / entry.dailyNeed;
}

/**
 * The single cheapest thing that buys the most days of whatever runs out
 * first.
 *
 * One unit, not a shopping list. The acquisition tiers already answer "what
 * should I buy in total"; this answers "what do I do now", and the whole value
 * of it is that the answer is one thing a person can act on today.
 *
 * Ordered by `valuePerDollar` and nothing else, the same rule every other
 * recommendation in the app follows (§7, D14).
 */
export function nextMove(
  coverage: readonly Coverage[],
  catalog: readonly CatalogItem[],
  hazards: readonly HazardId[] | undefined,
): NextMove | undefined {
  const binding = bindingResourcesFor(hazards);
  const daysNow = limitingDays(coverage, binding);

  // The binding entry: among the resources that genuinely bind, the one with
  // the fewest days. Ties go to the first in coverage order, which is water.
  const candidates = coverage
    .filter((entry) => binding.has(entry.resource) && entry.dailyNeed > 0)
    .sort((a, b) => daysOf(a) - daysOf(b));

  const bindingEntry = candidates[0];
  if (!bindingEntry) return undefined;

  const options = catalog
    .filter((item) =>
      (item.provides ?? []).some(
        (contribution) => contribution.resource === bindingEntry.resource && contribution.perUnit > 0,
      ),
    )
    .sort((a, b) => b.valuePerDollar - a.valuePerDollar);

  const item = options[0];
  if (!item) return undefined; // Nothing in the catalogue provides it. Say nothing.

  const perUnit = (item.provides ?? []).find(
    (contribution) => contribution.resource === bindingEntry.resource,
  )?.perUnit;
  if (!perUnit) return undefined;

  const units = 1;
  const added = perUnit * units;

  // Recompute the household number with the new stock in place, rather than
  // assuming the gain carries through. It often does not, and that is the
  // most useful thing this card says.
  const after = coverage.map((entry) =>
    entry.resource === bindingEntry.resource
      ? { ...entry, stock: entry.stock + added, days: (entry.stock + added) / entry.dailyNeed }
      : entry,
  );
  const daysAfter = limitingDays(after, binding);

  const nextLimit = after
    .filter((entry) => binding.has(entry.resource) && entry.dailyNeed > 0)
    .sort((a, b) => daysOf(a) - daysOf(b))[0];

  return {
    resource: bindingEntry.resource,
    item,
    units,
    addedWeightG: item.weightG * units,
    addedCostCents: item.typicalCostCents === undefined ? undefined : item.typicalCostCents * units,
    daysNow: Math.floor(daysNow),
    daysAfter: Math.floor(daysAfter),
    resourceDaysNow: Math.floor(daysOf(bindingEntry)),
    resourceDaysAfter: Math.floor(daysOf(after.find((e) => e.resource === bindingEntry.resource))),
    // Only worth naming when it is a DIFFERENT resource now holding the
    // number down. Still being limited by the thing you just bought is not a
    // lesson, it just means buy another one.
    thenLimitedBy:
      nextLimit && nextLimit.resource !== bindingEntry.resource ? nextLimit.resource : undefined,
  };
}

/** Whether a purchase crosses a doctrine milestone, for the payoff line. */
export function crossesMilestone(move: NextMove): ReadinessTier | undefined {
  const before = tierFor(move.daysNow);
  const after = tierFor(move.daysAfter);
  return before === after ? undefined : after;
}
