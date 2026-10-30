import type { Brief, Posture, Signal } from './schema';

/**
 * What one source contributes to a digest.
 *
 * A source may produce a county signal, Worth-knowing items, or both. Parsing
 * is kept pure and separate from fetching throughout, which is the only reason
 * any of this is testable: the APIs are not reachable from the machine that
 * wrote these adapters, so the parsers are exercised against recorded shapes
 * and the first real run happens in CI.
 */
export interface SourceResult {
  readonly signal?: Signal;
  readonly brief?: readonly Brief[];
  /**
   * Standing posture, corrected. A source that recomputes a baseline the pack
   * ships — the ENSO state, say — publishes it under the pack's own note id so
   * the client merges it in place rather than showing two.
   */
  readonly posture?: readonly Posture[];
}

export interface RegionSpec {
  /** County FIPS, or `default` for the national digest. */
  readonly region: string;
  readonly label: string;
  /** Two-letter state, for the sources that slice by state. */
  readonly state?: string;
  /**
   * A ZIP in the region, for AirNow, which reports by reporting area rather
   * than by county. A region without one gets no air-quality signal, and does
   * not count it in the denominator either.
   */
  readonly zip?: string;
}
