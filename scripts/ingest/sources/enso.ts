import { getText } from '../fetch';
import type { SourceResult } from '../types';
import type { Posture } from '../schema';

/**
 * ENSO — El Niño and La Niña, from NOAA's own index series.
 *
 * This source exists to solve a staleness problem rather than to add an
 * alert. The content pack ships a posture note saying what ENSO is doing, and
 * a baked-in claim about the climate state is exactly the kind of thing that
 * is true at build time and wrong four months later on a phone that has not
 * been opened. The digest can correct a posture note by id, so this
 * recomputes the note from the current data each day.
 *
 * It reads the Oceanic Niño Index series, which NOAA publishes as a stable
 * fixed-width text file. That is a deliberate choice over the ENSO Diagnostic
 * Discussion page: the discussion is prose written for humans and parsing it
 * would mean scraping a layout nobody promised to keep, while the index is a
 * table of numbers whose format has not changed in years.
 *
 * The classification is NOAA's own published rule, applied here rather than
 * invented: an event is in progress when the index sits at or beyond ±0.5 for
 * five consecutive overlapping three-month seasons. Nothing here forecasts.
 * The note states the condition that is present, which is all the index can
 * support.
 */

const ONI = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';

/** NOAA's threshold for an event, and the run length that makes it one. */
const THRESHOLD = 0.5;
const RUN = 5;

export interface OniReading {
  /** Three-letter overlapping season, e.g. `NDJ`. */
  readonly season: string;
  readonly year: number;
  /** The anomaly in degrees Celsius. Positive is El Niño's direction. */
  readonly anomaly: number;
}

/**
 * The file is a header line then whitespace-separated columns:
 * `SEAS YR TOTAL ANOM`. Rows that do not parse are skipped rather than
 * guessed at — a half-read climate record is worse than none.
 */
export function parseOni(text: string): readonly OniReading[] {
  const readings: OniReading[] = [];

  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;

    const [season, year, , anomaly] = parts;
    if (!season || !/^[A-Z]{3}$/.test(season)) continue; // header, or junk

    const y = Number(year);
    const a = Number(anomaly);
    if (!Number.isInteger(y) || Number.isNaN(a)) continue;

    readings.push({ season, year: y, anomaly: a });
  }

  return readings;
}

export type EnsoPhase = 'el-nino' | 'la-nina' | 'neutral';

export interface EnsoState {
  readonly phase: EnsoPhase;
  readonly latest: OniReading;
  /** How many consecutive seasons, ending at `latest`, are beyond threshold. */
  readonly run: number;
  /** The strongest anomaly in that run, by magnitude. */
  readonly peak: number;
}

export function ensoState(readings: readonly OniReading[]): EnsoState | undefined {
  const latest = readings[readings.length - 1];
  if (!latest) return undefined;

  // Which direction the current run would have to be in to count.
  const sign = latest.anomaly >= THRESHOLD ? 1 : latest.anomaly <= -THRESHOLD ? -1 : 0;
  if (sign === 0) return { phase: 'neutral', latest, run: 0, peak: latest.anomaly };

  let run = 0;
  let peak = 0;
  for (let i = readings.length - 1; i >= 0; i -= 1) {
    const anomaly = readings[i]?.anomaly;
    if (anomaly === undefined || anomaly * sign < THRESHOLD) break;
    run += 1;
    if (Math.abs(anomaly) > Math.abs(peak)) peak = anomaly;
  }

  // Beyond the threshold but not for long enough is not yet an event. Saying
  // otherwise would be forecasting one.
  const phase: EnsoPhase = run < RUN ? 'neutral' : sign > 0 ? 'el-nino' : 'la-nina';
  return { phase, latest, run, peak };
}

/** NOAA's own strength bands, by peak anomaly. */
function strength(peak: number): string {
  const magnitude = Math.abs(peak);
  if (magnitude >= 2.0) return 'very strong';
  if (magnitude >= 1.5) return 'strong';
  if (magnitude >= 1.0) return 'moderate';
  return 'weak';
}

const WHAT_IT_MEANS: Readonly<Record<EnsoPhase, string>> = {
  'el-nino':
    "This is the rare kind of warning that arrives months early. El Nino winters tend to run wetter across the southern tier of the United States and drier across the Pacific Northwest and the Ohio Valley, with a warmer north. It does not say a flood is coming to your street; it says which of your county's hazards is the one to weight this season, and it says so with months to spare. The practical consequence is the horizon: a signal measured in seasons is an argument for stocking against a season rather than against seventy-two hours, at ordinary prices rather than during a run on a shop.",
  'la-nina':
    "La Nina winters tend to run drier across the southern tier of the United States and wetter across the Pacific Northwest and the Ohio Valley, with a more active Atlantic hurricane season. It does not say anything is coming to your street; it says which of your county's hazards is the one to weight this season. The practical consequence is the horizon: a signal measured in seasons is an argument for stocking against a season rather than against seventy-two hours.",
  neutral:
    'Neither phase is established, which means the seasonal outlook carries no steer in either direction and your county\'s own hazard profile is the better guide. Worth knowing mainly because its absence is also information: there is no basis here for weighting one season over another.',
};

/**
 * Build the posture note. Same id as the one in the content pack, which is
 * what makes this a correction rather than a second note (worldContext merges
 * by id).
 */
export function postureFor(state: EnsoState, now: Date): Posture {
  const season = `${state.latest.season} ${state.latest.year}`;
  const anomaly = state.latest.anomaly.toFixed(1);
  const today = now.toISOString().slice(0, 10);

  const title =
    state.phase === 'el-nino'
      ? `A ${strength(state.peak)} El Nino is present`
      : state.phase === 'la-nina'
        ? `A ${strength(state.peak)} La Nina is present`
        : 'Neither El Nino nor La Nina is established';

  const whatItIs =
    state.phase === 'neutral'
      ? `NOAA's Oceanic Nino Index stands at ${anomaly} C for the ${season} season. An event is recorded when the index sits at or beyond plus or minus 0.5 C for five consecutive overlapping seasons, and that condition is not currently met. ENSO is the El Nino-Southern Oscillation: a shift in Pacific sea surface temperatures that reorganises where storm tracks go for a season at a time.`
      : `NOAA's Oceanic Nino Index stands at ${anomaly} C for the ${season} season, the ${state.run}th consecutive season at or beyond the plus or minus 0.5 C threshold, peaking at ${state.peak.toFixed(1)} C. NOAA records an event once that threshold holds for five consecutive overlapping seasons. ENSO is the El Nino-Southern Oscillation: a shift in Pacific sea surface temperatures that reorganises where storm tracks go for a season at a time. This states the condition present now, not an outlook.`;

  return {
    id: 'enso-el-nino',
    title,
    published: today,
    epistemicStatus: 'official',
    whatItIs,
    whatItMeansForYou: WHAT_IT_MEANS[state.phase],
    // A season, which is the timescale the signal actually describes. It is
    // shown next to the household's own target and never changes it.
    ...(state.phase === 'neutral' ? {} : { horizonSignalDays: 120 }),
    citations: [
      {
        source: 'NOAA Climate Prediction Center',
        title: 'Oceanic Nino Index (ONI), monthly values',
        published: today,
        url: ONI,
        basis: 'us-federal-work' as const,
      },
      {
        source: 'NOAA Climate Prediction Center',
        title: 'ENSO Diagnostic Discussion',
        published: today,
        url: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.html',
        basis: 'us-federal-work' as const,
      },
    ],
    lastReviewed: today,
  };
}

export function parseEnso(text: string, now: Date): SourceResult {
  const state = ensoState(parseOni(text));
  // Nothing parsed. Say nothing and let the pack's own note stand, rather
  // than publishing a claim about the climate derived from an empty file.
  if (!state) return {};
  return { posture: [postureFor(state, now)] };
}

export async function collectEnso(now: Date): Promise<SourceResult> {
  return parseEnso(await getText(ONI, { retries: 1, backoffMs: 2_000 }), now);
}
