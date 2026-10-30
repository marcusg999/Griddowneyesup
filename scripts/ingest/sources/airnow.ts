import { getJson } from '../fetch';
import type { SourceResult } from '../types';
import type { Signal } from '../schema';

/**
 * AirNow — EPA and USFS air quality, which on the west coast means wildfire
 * smoke.
 *
 * This source has been in the signal union and in the fixtures since step 7
 * and had no collector, so every live digest reported one fewer source than
 * the confidence line claimed and nothing said why. It is here now.
 *
 * It is the only source that needs a key. AirNow issues them free on request,
 * and the key is read from the environment rather than committed: a key in a
 * public repository is a key that gets revoked. Without one the source is not
 * attempted at all — which is different from being unreachable, and the
 * difference now shows up in the denominator rather than as a phantom gap.
 *
 * Observations rather than forecasts, deliberately. A forecast on a readiness
 * surface is a prediction, and §4.4 does not allow one.
 */

const ENDPOINT = 'https://www.airnowapi.org/aq/observation/zipCode/current/';

export function apiKey(): string | undefined {
  const key = (process.env['AIRNOW_API_KEY'] ?? '').trim();
  return key.length > 0 ? key : undefined;
}

export function queryUrl(zip: string, key: string): string {
  const params = new URLSearchParams({
    format: 'application/json',
    zipCode: zip,
    // Nearest reporting area within 25 miles. Wider than that and the reading
    // describes somewhere else's air.
    distance: '25',
    API_KEY: key,
  });
  return `${ENDPOINT}?${params.toString()}`;
}

interface Observation {
  readonly DateObserved?: string | null;
  readonly HourObserved?: number | null;
  readonly ReportingArea?: string | null;
  readonly StateCode?: string | null;
  readonly ParameterName?: string | null;
  readonly AQI?: number | null;
  readonly Category?: { readonly Number?: number | null; readonly Name?: string | null } | null;
}

/**
 * AirNow's own category scale, 1–6. Mapped onto the band's three levels:
 *
 *   1 Good, 2 Moderate            → quiet
 *   3 Unhealthy for Sensitive     → elevated
 *   4 Unhealthy and worse         → active
 *
 * The break sits at 3 rather than 4 because category 3 is the point at which
 * official guidance starts telling people with asthma, heart conditions, and
 * children to change what they do — which is the threshold a household cares
 * about, not the one a healthy adult does.
 */
export function levelFor(category: number): Signal['level'] {
  if (category >= 4) return 'active';
  if (category === 3) return 'elevated';
  return 'quiet';
}

/**
 * AirNow reports a local date and an integer local hour with a timezone
 * abbreviation, which is not a parseable timestamp. The date is taken as the
 * observation day at the stated hour in UTC.
 *
 * Deliberately approximate, and the freshness window for this source is
 * twelve hours, so an error of a few hours cannot make a stale reading look
 * current. Guessing an offset from a timezone abbreviation would be worse:
 * "CST" is three different offsets depending on the country.
 */
export function observedAt(date: string | null | undefined, hour: number | null | undefined): string | undefined {
  const day = (date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const h = typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0;
  const iso = `${day}T${String(h).padStart(2, '0')}:00:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

const MEANS_FOR_YOU: Readonly<Record<Signal['level'], string>> = {
  active:
    'Air at this level affects everyone, not only people with existing conditions. Indoors with windows shut is the standard advice, and a box fan with a furnace filter taped to it is the cheap version of an air cleaner.',
  elevated:
    'At this level official guidance is aimed at children, older people and anyone with asthma or a heart condition: less time outdoors, and less exertion when outside.',
  quiet: 'Nothing here needs doing. Reported so the absence of a problem is also on the record.',
};

export function parseAirNow(raw: unknown, area: string): SourceResult {
  const rows = Array.isArray(raw) ? (raw as readonly Observation[]) : [];

  // Several parameters are reported for one place — PM2.5, ozone, PM10. The
  // worst one is the one that governs what a household should do.
  let worst: Observation | undefined;
  for (const row of rows) {
    const category = row?.Category?.Number;
    if (typeof category !== 'number') continue;
    if (!worst || category > (worst.Category?.Number ?? 0)) worst = row;
  }

  const category = worst?.Category?.Number;
  const when = observedAt(worst?.DateObserved, worst?.HourObserved);

  // No reading at all is not a quiet reading. Reporting "quiet" from an empty
  // response would invent an observation, so the source reports nothing and
  // is recorded as a gap instead.
  if (!worst || typeof category !== 'number' || !when) return {};

  const level = levelFor(category);
  const parameter = worst.ParameterName ?? 'Air quality';
  const where = worst.ReportingArea ?? area;
  const aqi = typeof worst.AQI === 'number' ? worst.AQI : undefined;

  const signal: Signal = {
    source: 'wildfire-air',
    sourceName: 'AirNow (EPA and US Forest Service)',
    level,
    // Their scale and their words, with the number that produced them.
    headline: `${where}: ${parameter} ${worst.Category?.Name ?? 'reading'}${aqi === undefined ? '' : ` (AQI ${aqi})`}`,
    meansForYou: MEANS_FOR_YOU[level],
    url: 'https://www.airnow.gov/',
    observedAt: when,
  };

  return { signal };
}

export async function collectAirNow(zip: string, area: string): Promise<SourceResult> {
  const key = apiKey();
  // The orchestrator checks for the key before attempting this source, so
  // reaching here without one is a programming error rather than a gap.
  if (!key) throw new Error('AIRNOW_API_KEY is not set');
  return parseAirNow(await getJson(queryUrl(zip, key), { retries: 1, backoffMs: 2_000 }), area);
}
