import type { Offer } from '@/content/types';

/**
 * Commerce. §14, CONTENT_POLICY §7.
 *
 * The integrity constraints from the brief, implemented rather than promised:
 *
 *   1. Ordering is computed BEFORE any commerce data is joined. This module
 *      only ever receives an already-ordered list and returns it in the same
 *      order — it has no sort, no score, no rank.
 *   2. Removing every offer leaves the order byte-identical. Tested.
 *   3. Disclosure renders adjacent to each link, never in a footer.
 *   4. Affiliate status renders as a visible badge.
 *
 * Plus one the brief did not need to state because it had not yet allowed
 * affiliate links next to a live threat feed:
 *
 *   5. Offers never appear on a threat, posture or exposure surface. Pairing
 *      "fuel is up 25 percent" with a buy button is fear as a conversion
 *      mechanic, which §6 forbids outright. Tested.
 */

/** How long an unchecked offer keeps its link. */
const OFFER_FRESH_DAYS = 45;

export interface WithOffers<T> {
  readonly subject: T;
  readonly offers: readonly Offer[];
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

/**
 * A stale offer is dropped rather than shown.
 *
 * A dead link or a wrong price on a preparedness list is worse than no link:
 * it sends someone to buy the wrong thing, and it is the kind of rot nobody
 * notices because the page still renders.
 */
export function freshOffers(
  offers: readonly Offer[],
  now: Date = new Date(),
): readonly Offer[] {
  return offers.filter((o) => daysSince(o.asOf, now) <= OFFER_FRESH_DAYS);
}

/**
 * Decorates an ALREADY ORDERED list with offers.
 *
 * Note the shape of this function: it takes an ordered list and maps over it.
 * There is no sort here and no way to introduce one without changing the
 * signature, which is what keeps constraint 1 true under refactoring.
 */
export function attachOffers<T extends { id: string }>(
  ordered: readonly T[],
  offers: readonly Offer[],
  now: Date = new Date(),
): ReadonlyArray<WithOffers<T>> {
  const fresh = freshOffers(offers, now);
  const byItem = new Map<string, Offer[]>();
  for (const offer of fresh) {
    const list = byItem.get(offer.itemId);
    if (list) list.push(offer);
    else byItem.set(offer.itemId, [offer]);
  }
  // map preserves input order; nothing here can reorder.
  return ordered.map((subject) => ({ subject, offers: byItem.get(subject.id) ?? [] }));
}

/**
 * Surfaces where offers may never be rendered.
 *
 * Exported so the rule is one list rather than scattered conditionals, and so
 * a test can assert it.
 */
export const COMMERCE_FORBIDDEN_SURFACES = [
  'today',
  'threat',
  'posture',
  'exposure',
  'grey-sky',
] as const;

export type CommerceSurface = 'supplies' | 'acquisition' | (typeof COMMERCE_FORBIDDEN_SURFACES)[number];

export function mayShowOffers(surface: CommerceSurface): boolean {
  return !(COMMERCE_FORBIDDEN_SURFACES as readonly string[]).includes(surface);
}
