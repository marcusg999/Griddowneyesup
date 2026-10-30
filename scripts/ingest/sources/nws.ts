import { getJson } from '../fetch';
import type { SourceResult } from '../types';
import type { Signal } from '../schema';

/**
 * National Weather Service active alerts, sliced by state.
 *
 * NWS is the local signal rather than a Worth-knowing source: an alert is
 * about here, and the feed has no stable human-facing page per alert. The
 * signal links to the state's alert list, which is the page a reader actually
 * wants.
 *
 * NWS refuses requests without a contactable User-Agent, which is set in
 * fetch.ts for every source rather than remembered here.
 */

interface NwsAlerts {
  readonly features?: ReadonlyArray<{
    readonly properties?: {
      readonly event?: string | null;
      readonly severity?: string | null;
      readonly urgency?: string | null;
      readonly effective?: string | null;
      readonly areaDesc?: string | null;
    };
  }>;
}

/** NWS severity, mapped to the three levels the band understands. */
function levelFor(severities: readonly string[]): Signal['level'] {
  if (severities.some((s) => s === 'Extreme' || s === 'Severe')) return 'active';
  if (severities.some((s) => s === 'Moderate')) return 'elevated';
  return 'quiet';
}

export function parseNws(raw: unknown, state: string, now: Date): SourceResult {
  const alerts = raw as NwsAlerts;
  const features = Array.isArray(alerts?.features) ? alerts.features : [];

  const events = features
    .map((f) => f?.properties)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.event));

  const severities = events.map((p) => p.severity ?? 'Unknown');
  const level = levelFor(severities);

  // Named rather than counted. "3 alerts" tells a reader nothing; "Flood
  // Warning, Wind Advisory" tells them whether to keep reading.
  const names = [...new Set(events.map((p) => p.event as string))].slice(0, 4);

  const signal: Signal = {
    source: 'nws',
    sourceName: 'National Weather Service',
    level,
    headline:
      names.length > 0
        ? `${names.join(', ')}${events.length > names.length ? ` and ${events.length - names.length} more` : ''}`
        : 'No watches, warnings or advisories in effect',
    meansForYou:
      level === 'active'
        ? 'At least one of these is severe or extreme. The issuing office is the authority on what to do; this is only telling you it exists.'
        : level === 'elevated'
          ? 'Nothing requiring action on its own, but this is the kind of thing that takes the power out for a few hours.'
          : 'Nothing to act on.',
    url: `https://alerts.weather.gov/search?area=${encodeURIComponent(state)}`,
    observedAt: now.toISOString(),
  };

  return { signal };
}

export async function collectNws(state: string, now: Date): Promise<SourceResult> {
  const url = `https://api.weather.gov/alerts/active?area=${encodeURIComponent(state)}`;
  return parseNws(await getJson(url), state, now);
}
