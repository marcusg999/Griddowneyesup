import type { CatalogItem, KitDefinition, KitId } from '@/content/types';
import type { InventoryRecord, Profile } from '@/db/types';

/**
 * Kit ladder completeness and carry-weight budgeting. §4.2.
 *
 * An item belongs to many kits at once: one inventory record, many
 * memberships. Per-kit completeness is computed, never re-entered.
 */

/**
 * A rung completes at 80% of its items WITH all critical items present.
 * Not 100% — perfectionism kills retention, and a kit at 80% holding every
 * critical item is a kit that works.
 */
export const COMPLETION_THRESHOLD = 0.8;

export interface KitStatus {
  readonly kit: KitDefinition;
  readonly present: number;
  readonly total: number;
  readonly fraction: number;
  readonly missingCritical: readonly string[];
  readonly complete: boolean;
  /** Grams. Undefined for kits with no carry budget. */
  readonly weightG: number | undefined;
  readonly weightBudgetG: number | undefined;
  readonly overBudgetG: number | undefined;
}

export function kitStatus(
  kit: KitDefinition,
  inventory: readonly InventoryRecord[],
  catalog: readonly CatalogItem[],
  profile: Profile | undefined,
): KitStatus {
  const inThisKit = inventory.filter((r) => r.kits.includes(kit.id) && r.quantity > 0);
  const heldIds = new Set(inThisKit.map((r) => r.itemId));

  const present = kit.baseItems.filter((id) => heldIds.has(id)).length;
  const total = kit.baseItems.length;
  const fraction = total === 0 ? 1 : present / total;
  const missingCritical = kit.criticalItems.filter((id) => !heldIds.has(id));

  let weightG: number | undefined;
  let weightBudgetG: number | undefined;
  let overBudgetG: number | undefined;

  if (kit.weightBudgeted) {
    const byId = new Map(catalog.map((i) => [i.id, i]));
    weightG = inThisKit.reduce(
      (sum, r) => sum + (byId.get(r.itemId)?.weightG ?? 0) * r.quantity,
      0,
    );
    if (profile?.bodyweightKg) {
      weightBudgetG = profile.bodyweightKg * 1000 * profile.carryFraction;
      overBudgetG = weightG > weightBudgetG ? weightG - weightBudgetG : undefined;
    }
  }

  return {
    kit,
    present,
    total,
    fraction,
    missingCritical,
    complete: fraction >= COMPLETION_THRESHOLD && missingCritical.length === 0,
    weightG,
    weightBudgetG,
    overBudgetG,
  };
}

/** One rung as the UI consumes it: its state, whether it is reachable yet, and what gates it. */
export interface LadderRung {
  readonly status: KitStatus;
  readonly locked: boolean;
  readonly prerequisite: KitDefinition | undefined;
}

/**
 * The ladder is the onboarding sequence. A rung unlocks when the one below it
 * is complete — nobody starts with an INCH bag, and showing someone a
 * seven-kit checklist on day one is how this category loses people.
 */
export function ladderWithLocks(
  kits: readonly KitDefinition[],
  statuses: ReadonlyMap<KitId, KitStatus>,
): LadderRung[] {
  const ordered = [...kits].sort((a, b) => a.rung - b.rung);

  return ordered.flatMap((kit, index) => {
    const status = statuses.get(kit.id);
    if (!status) return [];
    const previous = index > 0 ? ordered[index - 1] : undefined;
    const previousStatus = previous ? statuses.get(previous.id) : undefined;
    return [
      {
        status,
        locked: previous !== undefined && previousStatus?.complete !== true,
        prerequisite: previous,
      },
    ];
  });
}

/**
 * Ladder order for drawing: top rung first.
 *
 * The progression is computed bottom-up, because a rung unlocks when the one
 * below it is complete. Drawing it in that same order puts rung 1 at the top of
 * the screen and the hardest kit out of sight at the bottom, which reads as an
 * upside-down ladder — the foot of a ladder belongs at the foot.
 *
 * Climbing order is untouched: Everyday Carry is still what unlocks first, and
 * the locks here are the same locks. Only the drawing is reversed.
 */
export function topRungFirst(ladder: readonly LadderRung[]): LadderRung[] {
  return [...ladder].reverse();
}

/**
 * The trade, stated plainly. Almost everyone builds a bug-out bag they cannot
 * carry for a mile, and "you are 2.1 kg over" is less useful than knowing what
 * dropping the hatchet actually buys you.
 */
export function weightTradeoff(
  candidate: CatalogItem,
): { dropped: string; gains: string } | undefined {
  // One litre of water weighs one kilogram, which makes it the most useful
  // unit of comparison available — and the thing people actually run short of.
  const litres = candidate.weightG / 1000;
  if (litres < 0.25) return undefined;
  return { dropped: candidate.name, gains: `${litres.toFixed(1)} L of water` };
}
