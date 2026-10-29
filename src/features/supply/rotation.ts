import type { CatalogItem } from '@/content/types';
import type { InventoryRecord } from '@/db/types';

/**
 * Expiry and rotation. §4.2.
 *
 * The unglamorous half of preparedness and the half that actually fails:
 * everyone buys the water, nobody rotates it. Framed as "use these this
 * month" rather than as a warning, because the item is still perfectly good
 * today — that is the entire point of catching it now.
 *
 * Note what this is not: a countdown designed to create urgency. An item
 * expiring is a real event with a real date on the packaging (policy G06).
 */

export type RotationBucket = 'expired' | 'this-month' | 'this-quarter';

export interface RotationEntry {
  readonly record: InventoryRecord;
  readonly item: CatalogItem | undefined;
  readonly bucket: RotationBucket;
  /** Negative once past. */
  readonly daysRemaining: number;
}

const daysBetween = (from: Date, toIso: string): number =>
  Math.floor((new Date(toIso).getTime() - from.getTime()) / 86_400_000);

export function rotationQueue(
  inventory: readonly InventoryRecord[],
  catalog: readonly CatalogItem[],
  now: Date = new Date(),
): readonly RotationEntry[] {
  const byId = new Map(catalog.map((i) => [i.id, i]));

  return inventory
    .filter((r) => r.expiresOn && r.quantity > 0)
    .map((record) => {
      const daysRemaining = daysBetween(now, record.expiresOn as string);
      const bucket: RotationBucket =
        daysRemaining < 0 ? 'expired' : daysRemaining <= 31 ? 'this-month' : 'this-quarter';
      return { record, item: byId.get(record.itemId), bucket, daysRemaining };
    })
    .filter((e) => e.bucket !== 'this-quarter' || e.daysRemaining <= 92)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function expiredCount(
  inventory: readonly InventoryRecord[],
  now: Date = new Date(),
): number {
  const today = now.toISOString().slice(0, 10);
  return inventory.filter((r) => r.expiresOn && r.quantity > 0 && r.expiresOn < today).length;
}

/**
 * A suggested expiry for a newly added item, from its catalog shelf life.
 * Saves the user doing date arithmetic for the common case, and is editable.
 */
export function suggestedExpiry(
  item: CatalogItem | undefined,
  now: Date = new Date(),
): string | undefined {
  if (!item?.shelfLifeDays) return undefined;
  const d = new Date(now.getTime() + item.shelfLifeDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}
