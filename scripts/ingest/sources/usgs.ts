import { getJson } from '../fetch';
import type { SourceResult } from '../types';
import type { Brief, Signal } from '../schema';

/**
 * USGS earthquake feed. Free, no key, and the cleanest of the six: every event
 * carries its own human-readable event page, which is exactly the live link
 * §4.4 requires.
 *
 * The "significant" feed rather than "all": a magnitude 2 in the desert is not
 * worth knowing, and a feed that reports everything trains people to read
 * nothing.
 */

const SIGNIFICANT_WEEK =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson';

interface UsgsFeed {
  readonly features?: ReadonlyArray<{
    readonly id?: string;
    readonly properties?: {
      readonly mag?: number | null;
      readonly place?: string | null;
      readonly time?: number | null;
      readonly url?: string | null;
      readonly title?: string | null;
      readonly tsunami?: number | null;
    };
  }>;
}

export function parseUsgs(raw: unknown, now: Date): SourceResult {
  const feed = raw as UsgsFeed;
  const features = Array.isArray(feed?.features) ? feed.features : [];

  const brief: Brief[] = [];
  for (const feature of features) {
    const p = feature?.properties;
    // Every one of these is mandatory downstream. A record missing any of them
    // is dropped rather than published with a gap.
    if (!p?.url || !p.title || typeof p.time !== 'number') continue;

    brief.push({
      id: `usgs-${feature.id ?? p.url}`,
      category: 'disaster',
      headline: p.title,
      whatItMeansForYou:
        p.tsunami === 1
          ? 'A tsunami evaluation was triggered for this event. If you are on a coast in the affected region, local emergency management is the authority on whether to move.'
          : 'Significant enough to be worth knowing about. Distant quakes matter to a household mainly through supply routes and relatives, not shaking.',
      url: p.url,
      source: 'USGS Earthquake Hazards Program',
      published: new Date(p.time).toISOString(),
      epistemicStatus: 'official',
      ...(p.place ? { where: p.place } : {}),
    });
  }

  // The signal is about whether anything significant happened at all, which is
  // a different question from the cards.
  const recent = brief.filter(
    (b) => now.getTime() - Date.parse(b.published) < 24 * 3_600_000,
  );
  const signal: Signal = {
    source: 'usgs',
    sourceName: 'USGS Earthquake Hazards Program',
    level: recent.length > 0 ? 'elevated' : 'quiet',
    headline:
      recent.length > 0
        ? `${recent.length} significant event${recent.length === 1 ? '' : 's'} worldwide in the last 24 hours`
        : 'No significant events worldwide in the last 24 hours',
    meansForYou:
      recent.length > 0
        ? 'Check the cards below for where. Distance is what decides whether this is yours to act on.'
        : 'Nothing to act on.',
    url: 'https://earthquake.usgs.gov/earthquakes/map/',
    observedAt: now.toISOString(),
  };

  return { signal, brief };
}

export async function collectUsgs(now: Date): Promise<SourceResult> {
  return parseUsgs(await getJson(SIGNIFICANT_WEEK), now);
}
