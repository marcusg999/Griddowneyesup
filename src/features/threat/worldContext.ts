import type { Indicator, PostureNote } from '@/content/types';
import type { BriefItem, ThreatSnapshot } from './types';

/**
 * World context, merged.
 *
 * Standing posture (§9) and economic indicators (§10) shipped inside the
 * content pack, which meant they were frozen at build time: the Strait of
 * Hormuz could reopen and the app would keep saying it was shut until somebody
 * cut a release. Baseline context that is measured in months still changes,
 * and a stale claim about the world is worse than no claim.
 *
 * So a digest may now carry them, and what it carries wins by id. The pack is
 * the floor — what the app knows with no network, forever — and the digest is
 * the correction on top.
 *
 * It wins by id rather than replacing the list wholesale, deliberately: a
 * publisher that can only reach four of six sources should be able to correct
 * the two it has without silently dropping the rest.
 */

/**
 * Overlay wins per id, base order preserved, genuinely new entries appended.
 */
function mergeById<T extends { readonly id: string }>(
  base: readonly T[],
  overlay: readonly T[] | undefined,
): readonly T[] {
  if (!overlay?.length) return base;

  const byId = new Map(overlay.map((item) => [item.id, item]));
  const merged = base.map((item) => byId.get(item.id) ?? item);
  const seen = new Set(base.map((item) => item.id));

  return [...merged, ...overlay.filter((item) => !seen.has(item.id))];
}

export interface WorldContext {
  readonly posture: readonly PostureNote[];
  readonly indicators: readonly Indicator[];
  /** Newest first, and finite — there is no more to scroll (§5). */
  readonly brief: readonly BriefItem[];
}

export function worldContext(
  pack: { readonly posture: readonly PostureNote[]; readonly indicators: readonly Indicator[] } | undefined,
  snapshot: ThreatSnapshot | undefined,
): WorldContext {
  const base: WorldContext = {
    posture: pack?.posture ?? [],
    indicators: pack?.indicators ?? [],
    // The pack ships no brief items. They are events with live links, which
    // means they go stale, which means they belong to the publisher and not
    // to a build artifact that may sit on a phone for months.
    brief: [],
  };

  // A sample digest never contributes world context, whatever it carries.
  // A fabricated signal is bad enough; a fabricated posture note is a claim
  // about a government's actions wearing an epistemic status that means
  // "traceable to a published source" (D21). The schema allows it so the real
  // pipeline can use it — the fixtures are not allowed to.
  if (!snapshot || snapshot.provenance === 'sample') return base;

  return {
    posture: mergeById(base.posture, snapshot.posture),
    indicators: mergeById(base.indicators, snapshot.indicators),
    // Newest first. An item with an unparseable date sorts last rather than
    // throwing the whole feed into an arbitrary order.
    brief: [...(snapshot.brief ?? [])].sort(
      (a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0),
    ),
  };
}
