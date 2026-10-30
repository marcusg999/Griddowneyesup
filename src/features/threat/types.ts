/**
 * The threat snapshot. §4.1, D10, D11.
 *
 * A snapshot is the once-daily digest for one region, published as a signed
 * static file and read cache-first. It is not a feed: it is finite, it ends,
 * and it carries no cursor to scroll into (CONTENT_POLICY §5).
 *
 * Six sources per D10. Five are live signals; the FEMA National Risk Index is
 * the standing county baseline and is deliberately NOT a signal — it is
 * measured in decades and must never move the readiness state. It already has
 * its own surface in the posture notes, and is listed here only so the
 * confidence line can say how many of the six were reachable.
 */

export type SignalSourceId = 'nws' | 'usgs' | 'wildfire-air' | 'openfema' | 'swpc';

/**
 * Per-signal state. Deliberately three values and no number: these inputs have
 * different units, cadences and reliability, and D11 rejected the composite
 * for exactly that reason.
 */
export type SignalLevel = 'quiet' | 'elevated' | 'active';

export interface ThreatSignal {
  readonly source: SignalSourceId;
  /** The publisher, named. Mandatory — §4.4. */
  readonly sourceName: string;
  readonly level: SignalLevel;
  /**
   * What the source says, in the source's own terms. Never editorialized,
   * never predictive, never a synthesis of several stories (§4.4).
   */
  readonly headline: string;
  /**
   * The plain-language consequence for this reader. Mandatory on every signal
   * — a status with no "so what" is a status that gets scrolled past.
   */
  readonly meansForYou: string;
  /** Direct link to the source item. Mandatory — §4.4. */
  readonly url: string;
  /** When the SOURCE observed it, not when we fetched it. Mandatory — §4.4. */
  readonly observedAt: string;
}

/**
 * Where the digest came from.
 *
 * Deliberately NOT folded into `EpistemicStatus`: that type's three values
 * ('official', 'press-reported', 'mixed') all assert the underlying thing
 * happened, and a sample digest asserts nothing at all. Conflating them would
 * put fabricated signals behind a label that means "traceable to a published
 * government source", which is the one thing it must never say.
 *
 * `sample` is what ships while the ingestion pipeline does not exist. It is
 * rendered with an unmissable notice, and it is barred from suggesting a
 * readiness state — see threatIndex().
 */
export type SnapshotProvenance = 'live' | 'sample';

import type { Indicator, PostureNote } from '@/content/types';

export interface ThreatSnapshot {
  readonly version: 1;
  readonly provenance: SnapshotProvenance;
  /** County FIPS, or a label for the fixture regions. */
  readonly region: string;
  readonly regionLabel: string;
  /** When this digest was cut. Drives the once-daily cadence. */
  readonly publishedAt: string;
  readonly signals: readonly ThreatSignal[];
  /**
   * Standing posture and economic indicators, when the publisher has fresher
   * ones than the pack shipped with. Optional: a digest that carries neither
   * leaves the pack's own in place.
   *
   * These are world context rather than local signals — §9 and §10 — and they
   * still never move the readiness state. They are here so baseline context
   * stops being frozen at build time, not so it can raise an alarm.
   */
  readonly posture?: readonly PostureNote[];
  readonly indicators?: readonly Indicator[];
  /**
   * Sources that could not be reached when the snapshot was cut. Named so the
   * confidence line can be specific rather than rounding a gap down to zero.
   */
  readonly unreachable?: readonly SignalSourceId[];
}

/** The six of D10, for the confidence denominator. */
export const SIGNAL_SOURCE_COUNT = 6;
