import type { CatalogItem, HazardId, ResourceKind } from '@/content/types';
import type { InventoryRecord, Profile } from '@/db/types';

/**
 * Gap analysis. §4.2.
 *
 * The headline number is not "items owned". It is "your household is covered
 * for 4 days of water and 11 days of calories" — a physical quantity the user
 * could verify by looking in a cupboard.
 *
 * This is also the app's score (D16). It is deliberately not a point total:
 * a score that rises because you opened an app is measuring the wrong thing.
 */

/** Per-person daily requirement by age band, per resource. */
const PER_PERSON_DAILY: Record<
  'infant' | 'child' | 'adult' | 'elder',
  Partial<Record<ResourceKind, number>>
> = {
  // One gallon (3.785 L) per person per day is the federal planning figure.
  // It covers drinking and minimal hygiene — not bathing, not laundry.
  infant: { 'water-litres': 2.0, 'calories-kcal': 800, 'sanitation-uses': 6 },
  child: { 'water-litres': 3.0, 'calories-kcal': 1600, 'sanitation-uses': 5 },
  adult: { 'water-litres': 3.785, 'calories-kcal': 2000, 'sanitation-uses': 5 },
  elder: { 'water-litres': 3.785, 'calories-kcal': 1800, 'sanitation-uses': 5 },
};

/** Household-level daily requirements that do not scale per person. */
const PER_HOUSEHOLD_DAILY: Partial<Record<ResourceKind, number>> = {
  'heat-hours': 3,
  'power-wh': 60,
};

/** Pets drink too, and plans routinely forget them. */
const PER_PET_DAILY: Partial<Record<ResourceKind, number>> = {
  'water-litres': 1.0,
};

export interface Coverage {
  readonly resource: ResourceKind;
  readonly stock: number;
  readonly dailyNeed: number;
  /** Stock divided by need. Undefined when the household needs none. */
  readonly days: number | undefined;
}

export type ReadinessTier = 'unprepared' | '72hour' | 'twoWeek' | 'oneMonth' | 'season';

/** Water first, always. It is always water. */
const RESOURCE_ORDER: ResourceKind[] = [
  'water-litres',
  'calories-kcal',
  'heat-hours',
  'power-wh',
  'sanitation-uses',
];

export function dailyNeeds(profile: Profile): Partial<Record<ResourceKind, number>> {
  const needs: Partial<Record<ResourceKind, number>> = { ...PER_HOUSEHOLD_DAILY };

  for (const member of profile.members) {
    for (const [resource, amount] of Object.entries(PER_PERSON_DAILY[member.ageBand])) {
      const key = resource as ResourceKind;
      needs[key] = (needs[key] ?? 0) + amount;
    }
  }

  for (let i = 0; i < profile.pets; i += 1) {
    for (const [resource, amount] of Object.entries(PER_PET_DAILY)) {
      const key = resource as ResourceKind;
      needs[key] = (needs[key] ?? 0) + amount;
    }
  }

  return needs;
}

export function computeCoverage(
  profile: Profile,
  inventory: readonly InventoryRecord[],
  catalog: readonly CatalogItem[],
): Coverage[] {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const stock = new Map<ResourceKind, number>();
  const today = new Date().toISOString().slice(0, 10);

  for (const record of inventory) {
    // Expired stock is not stock. This is the one place a number legitimately
    // falls, and it falls because food actually expired — not to manufacture
    // urgency (policy G06).
    if (record.expiresOn && record.expiresOn < today) continue;

    const item = byId.get(record.itemId);
    if (!item?.provides) continue;

    for (const contribution of item.provides) {
      stock.set(
        contribution.resource,
        (stock.get(contribution.resource) ?? 0) + contribution.perUnit * record.quantity,
      );
    }
  }

  const needs = dailyNeeds(profile);
  const resources = new Set<ResourceKind>([
    ...(Object.keys(needs) as ResourceKind[]),
    ...stock.keys(),
  ]);

  return [...resources]
    .map((resource) => {
      const dailyNeed = needs[resource] ?? 0;
      const held = stock.get(resource) ?? 0;
      return {
        resource,
        stock: held,
        dailyNeed,
        days: dailyNeed > 0 ? held / dailyNeed : undefined,
      };
    })
    .sort((a, b) => RESOURCE_ORDER.indexOf(a.resource) - RESOURCE_ORDER.indexOf(b.resource));
}

/**
 * Resources that genuinely bind the readiness tier.
 *
 * Water and calories are obvious. Sanitation is here because the brief is
 * right that it is the leading cause of illness in a prolonged outage and is
 * the thing households plan for least.
 *
 * Power is deliberately NOT here. A household with thirty days of water, food
 * and sanitation and no power bank is not "zero days prepared", and saying so
 * would be misleading in the pessimistic direction — which is its own kind of
 * dishonesty, and makes the number feel unreachable rather than useful.
 */
const ALWAYS_BINDING: readonly ResourceKind[] = [
  'water-litres',
  'calories-kcal',
  'sanitation-uses',
];

/** Heat binds only where the household's own hazards make cold a real risk. */
const COLD_HAZARDS = new Set<HazardId>(['winter-storm', 'grid-down']);

export function bindingResourcesFor(
  hazards: readonly HazardId[] | undefined,
): ReadonlySet<ResourceKind> {
  const binding = new Set<ResourceKind>(ALWAYS_BINDING);
  if ((hazards ?? []).some((h) => COLD_HAZARDS.has(h))) binding.add('heat-hours');
  return binding;
}

/**
 * The binding constraint is the resource you run out of first. A household
 * with ninety days of rice and two days of water has two days of coverage,
 * and saying otherwise would be flattering and useless.
 *
 * Only life-critical resources bind — see ALWAYS_BINDING above.
 */
export function limitingDays(
  coverage: readonly Coverage[],
  binding: ReadonlySet<ResourceKind> = new Set(ALWAYS_BINDING),
): number {
  const measured = coverage
    .filter((c) => binding.has(c.resource) && c.dailyNeed > 0 && c.days !== undefined)
    .map((c) => c.days as number);
  return measured.length === 0 ? 0 : Math.min(...measured);
}

/**
 * Tiers named after real preparedness doctrine rather than invented levels, so
 * reaching one means something outside the app. 72-Hour is the milestone that
 * matters most and the one worth celebrating.
 */
export function tierFor(days: number): ReadinessTier {
  if (days >= 90) return 'season';
  if (days >= 30) return 'oneMonth';
  if (days >= 14) return 'twoWeek';
  if (days >= 3) return '72hour';
  return 'unprepared';
}

/** Whole days, rounded down. Claiming 3.9 days is claiming 3. */
export const wholeDays = (days: number | undefined): number =>
  days === undefined ? 0 : Math.floor(days);
