import type { CatalogItem, KitDefinition } from '@/content/types';
import type { Achievement, InventoryRecord, Profile } from '@/db/types';
import type { Plan, Contact } from '@/features/plan/types';
import { bindingResourcesFor, computeCoverage, limitingDays, tierFor } from './coverage';
import { kitStatus } from './kits';
import { expiredCount } from './rotation';

/**
 * Achievements. D16.
 *
 * The governing rule, from the decision record: no mechanic may reward app
 * usage; every mechanic must reward real-world state. Everything below is
 * earned by something that happened outside the app — water bought, a plan
 * printed, a shutoff located — and is computed from stored state rather than
 * from an event the app fired at itself.
 *
 * Each is earned once. Nothing here can be lost, decay, or be compared
 * against another user (policy G01, G03, G06).
 */

export type AchievementSlug =
  | 'out-of-area'
  | 'shutoff-certified'
  | 'paper-trail'
  | 'cold-start'
  | 'seventy-two'
  | 'two-week'
  | 'fifty-dollars-in'
  | 'under-budget'
  | 'rotation-clear'
  | 'boring-competence';

export interface AchievementDef {
  readonly slug: AchievementSlug;
  readonly name: string;
  /** Why it is worth having, in the §6 register. */
  readonly note: string;
  /**
   * A STANDING achievement describes current state and stops being shown when
   * it stops being true. A MILESTONE records that something happened and is
   * kept forever.
   *
   * The distinction exists because "Nothing Expired" displayed next to a
   * rotation queue listing expired bleach is simply a lie, and a badge that
   * lies costs more trust than it ever bought. Policy G06 forbids a score
   * that decays from inaction — it explicitly does not protect a claim about
   * the present, and says food actually expiring is real and is shown.
   */
  readonly standing?: true;
}

/**
 * Names are where the humour lives (§6). Nothing here is inside a safety
 * instruction, so the register can be dry rather than flat.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    slug: 'out-of-area',
    name: 'Out of Area',
    note: 'You named a contact outside the region. It is the single most forgotten line in a household plan.',
  },
  {
    slug: 'shutoff-certified',
    name: 'Shutoff Certified',
    note: 'Gas, water and electrical, all located and written down. In daylight, which is the only sensible time to do it.',
  },
  {
    slug: 'paper-trail',
    name: 'Paper Trail',
    note: 'You printed the plan. The most likely failure in an emergency is a dead phone, and this app lives on one.',
  },
  {
    slug: 'cold-start',
    name: 'Cold Start',
    note: 'You opened this with the radio off and it worked. You have now verified the only claim that matters here.',
  },
  {
    slug: 'seventy-two',
    name: '72 Hours',
    note: 'Three days of everything. This is the milestone the whole category is built around, and most households never reach it.',
  },
  {
    slug: 'two-week',
    name: 'Two Weeks',
    note: 'Fourteen days. This is roughly what a real wide-area event actually asks of a household.',
  },
  {
    slug: 'fifty-dollars-in',
    name: 'Fifty Dollars In',
    note: 'You own everything in the first tier. It cost about the price of a takeaway for four.',
  },
  {
    slug: 'under-budget',
    name: 'Under Budget',
    note: 'Your bug out bag is under your carry limit. Most are not, and most people find out a mile from the house.',
    standing: true,
  },
  {
    slug: 'rotation-clear',
    name: 'Nothing Expired',
    note: 'Not one item past its date. Rotation is the unglamorous half of this and the half that actually fails.',
    standing: true,
  },
  {
    slug: 'boring-competence',
    name: 'Boring Competence',
    note: 'Ninety days, nothing expired, plan reviewed. This is what preparedness actually looks like and nobody makes a film about it.',
  },
];

export const achievementBySlug = new Map(ACHIEVEMENTS.map((a) => [a.slug, a]));

/** Slugs whose truth is about now rather than about the past. */
export const STANDING_SLUGS: ReadonlySet<AchievementSlug> = new Set(
  ACHIEVEMENTS.filter((a) => a.standing).map((a) => a.slug),
);

export interface AchievementInputs {
  readonly profile: Profile | undefined;
  readonly inventory: readonly InventoryRecord[];
  readonly items: readonly CatalogItem[];
  readonly kits: readonly KitDefinition[];
  readonly plan: Plan | undefined;
  readonly contacts: readonly Contact[];
  readonly earned: readonly Achievement[];
  /** Tier-50 catalog ids, so "fifty dollars in" is checked against content. */
  readonly tier50ItemIds: ReadonlySet<string>;
  readonly now?: Date;
}

const nonEmpty = (s: string | undefined): boolean => (s ?? '').trim().length > 0;

/**
 * Which achievements the current state has earned.
 *
 * Pure, and recomputed from stored state rather than from events — so an
 * achievement cannot be missed because the app was closed when it happened,
 * and cannot be farmed by repeating an action.
 */
export function earnedAchievements(input: AchievementInputs): Set<AchievementSlug> {
  const now = input.now ?? new Date();
  const earned = new Set<AchievementSlug>();

  // Milestones stay awarded forever: they record that something happened.
  // Standing achievements are recomputed below and are not restored here,
  // because they are claims about the present.
  for (const a of input.earned) {
    const slug = a.slug as AchievementSlug;
    if (!STANDING_SLUGS.has(slug)) earned.add(slug);
  }

  if (input.contacts.some((c) => c.outOfArea && nonEmpty(c.phone))) {
    earned.add('out-of-area');
  }

  const plan = input.plan;
  if (
    plan &&
    nonEmpty(plan.gas?.location) &&
    nonEmpty(plan.water?.location) &&
    nonEmpty(plan.electric?.location)
  ) {
    earned.add('shutoff-certified');
  }

  if (input.profile) {
    const coverage = computeCoverage(input.profile, input.inventory, input.items);
    const days = limitingDays(coverage, bindingResourcesFor(input.profile.hazards));
    const tier = tierFor(days);
    if (tier !== 'unprepared') earned.add('seventy-two');
    if (days >= 14) earned.add('two-week');
  }

  const heldIds = new Set(input.inventory.filter((r) => r.quantity > 0).map((r) => r.itemId));
  if (
    input.tier50ItemIds.size > 0 &&
    [...input.tier50ItemIds].every((id) => heldIds.has(id))
  ) {
    earned.add('fifty-dollars-in');
  }

  const bob = input.kits.find((k) => k.id === 'bob');
  if (bob && input.profile?.bodyweightKg) {
    const status = kitStatus(bob, input.inventory, input.items, input.profile);
    // Only meaningful once the bag actually contains something.
    if ((status.weightG ?? 0) > 0 && status.overBudgetG === undefined) {
      earned.add('under-budget');
    }
  }

  const dated = input.inventory.filter((r) => r.expiresOn);
  if (dated.length > 0 && expiredCount(input.inventory, now) === 0) {
    earned.add('rotation-clear');
  }

  // Ninety days of nothing expiring, with a plan that has been written down.
  // The slowest achievement in the set, on purpose: it is the one that
  // describes the actual practice rather than a single afternoon.
  if (earned.has('rotation-clear') && plan?.updatedAt) {
    const planAgeDays = (now.getTime() - new Date(plan.updatedAt).getTime()) / 86_400_000;
    const oldestRecord = input.inventory.reduce<number>((oldest, r) => {
      const age = (now.getTime() - new Date(r.addedAt).getTime()) / 86_400_000;
      return Math.max(oldest, age);
    }, 0);
    if (oldestRecord >= 90 && planAgeDays <= 180) earned.add('boring-competence');
  }

  return earned;
}
