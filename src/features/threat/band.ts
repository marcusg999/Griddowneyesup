import {
  SIGNAL_SOURCE_COUNT,
  type SignalLevel,
  type SignalSourceId,
  type ThreatSignal,
  type ThreatSnapshot,
} from './types';

/**
 * The Threat Index. D11.
 *
 * One qualitative band over the signal cards, derived by rules plain enough to
 * print. D11 rejected the 0-100 composite and the reasoning holds: the inputs
 * have different units, different cadences and different reliability, and
 * averaging them into a digit manufactures a precision we have not earned.
 *
 * The band carries its own reasons so it can justify itself on tap. A judgment
 * the user cannot inspect is indistinguishable from a number we made up.
 *
 * On the fourth band value. D11 lists GREY SKY alongside the three here, and
 * it is absent on purpose: Grey Sky is a declaration that it is happening, made
 * by the user (or, later, by D12's deliberately narrow life-safety gate). It is
 * not something a once-daily digest may infer. A digest that can strip the
 * interface to four buttons off the back of a stale feed is a digest that will
 * eventually do it wrongly, and the cost of being wrong in that direction is
 * the whole product.
 */

export type ThreatBand = 'quiet' | 'elevated' | 'active';

/**
 * How long each source stays authoritative. Per-source rather than one global
 * figure, because the cadences genuinely differ: an NWS warning is a matter of
 * minutes to an hour, while a federal disaster declaration is good for days.
 *
 * Treating a six-hour-old tornado warning as current would be manufacturing
 * alarm from a record that has almost certainly expired.
 */
const FRESH_FOR_HOURS: Record<SignalSourceId, number> = {
  nws: 6,
  'wildfire-air': 12,
  swpc: 12,
  usgs: 24,
  openfema: 72,
};

export interface BandReason {
  /** The rule that fired, in words, for the expanded view. */
  readonly text: string;
  readonly source?: SignalSourceId;
}

export interface ThreatIndex {
  readonly band: ThreatBand;
  /** True when the digest is illustrative. The surface must say so. */
  readonly isSample: boolean;
  /** Why the band is what it is. Rendered when the band is expanded. */
  readonly reasons: readonly BandReason[];
  /** Signals worth a card, most severe first. Quiet signals get no card. */
  readonly notable: readonly ThreatSignal[];
  readonly staleFor: readonly SignalSourceId[];
  /** Of D10's six. Drives "4 of 6 signals reporting". */
  readonly reportingCount: number;
  readonly sourceCount: number;
  /**
   * The readiness state these signals support. A suggestion the user accepts
   * or ignores — never applied on its own. See the note on GREY SKY above.
   */
  readonly suggests: 'blue-sky' | 'watch';
}

const SEVERITY: Record<SignalLevel, number> = { active: 2, elevated: 1, quiet: 0 };

export function isStale(
  signal: ThreatSignal,
  now: Date = new Date(),
): boolean {
  const freshHours = FRESH_FOR_HOURS[signal.source];
  const ageHours = (now.getTime() - new Date(signal.observedAt).getTime()) / 3_600_000;
  return !Number.isFinite(ageHours) || ageHours > freshHours;
}

/**
 * Derives the band. Pure, and given `now` explicitly so staleness is testable
 * rather than a function of when the suite happens to run.
 */
export function threatIndex(
  snapshot: ThreatSnapshot | undefined,
  now: Date = new Date(),
): ThreatIndex {
  const sourceCount = SIGNAL_SOURCE_COUNT;

  if (!snapshot) {
    return {
      band: 'quiet',
      isSample: false,
      reasons: [{ text: 'No digest has been read yet, so nothing has been assessed.' }],
      notable: [],
      staleFor: [],
      reportingCount: 0,
      sourceCount,
      suggests: 'blue-sky',
    };
  }

  const signals = snapshot.signals;
  const stale = signals.filter((s) => isStale(s, now));
  const staleFor = stale.map((s) => s.source);

  // A stale signal never raises the band. It is still rendered, with its level
  // and its age, so nothing is hidden — but a record we cannot vouch for is
  // not allowed to drive the judgment, and the confidence line says so.
  const current = signals.filter((s) => !isStale(s, now));

  const active = current.filter((s) => s.level === 'active');
  const elevated = current.filter((s) => s.level === 'elevated');

  const band: ThreatBand = active.length > 0 ? 'active' : elevated.length > 0 ? 'elevated' : 'quiet';

  const reasons: BandReason[] = [];
  for (const signal of [...active, ...elevated]) {
    reasons.push({ source: signal.source, text: `${signal.sourceName}: ${signal.headline}` });
  }
  if (band === 'quiet') {
    reasons.push({
      text:
        current.length > 0
          ? 'Every source that is reporting says there is nothing active.'
          : 'No source is currently reporting, so the band is held at quiet rather than guessed.',
    });
  }
  for (const signal of stale) {
    reasons.push({
      source: signal.source,
      text: `${signal.sourceName} is past its freshness window and was not counted toward the band.`,
    });
  }

  // Cards for anything with something to say, severest first, newest first
  // within a level. Stale signals keep their card: the user decides what a
  // nine-hour-old reading is worth, we just have to label it.
  const notable = signals
    .filter((s) => s.level !== 'quiet')
    .slice()
    .sort(
      (a, b) =>
        SEVERITY[b.level] - SEVERITY[a.level] ||
        new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime(),
    );

  return {
    band,
    isSample: snapshot.provenance === 'sample',
    reasons,
    notable,
    staleFor,
    // The NRI baseline is one of the six and is always available: it ships in
    // the content pack rather than arriving over a network.
    reportingCount: Math.min(sourceCount, current.length + 1),
    sourceCount,
    // "Something is forming" is the definition of WATCH (§3), which is exactly
    // what elevated means.
    //
    // A sample digest never suggests anything. Nudging someone toward a
    // readiness state on the strength of illustrative data would be the worst
    // kind of false alarm: one the product manufactured itself.
    suggests: band === 'quiet' || snapshot.provenance === 'sample' ? 'blue-sky' : 'watch',
  };
}
