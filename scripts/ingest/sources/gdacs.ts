import { getJson } from '../fetch';
import type { SourceResult } from '../types';
import type { Brief } from '../schema';

/**
 * GDACS — the Global Disaster Alert and Coordination System, run jointly by
 * the European Commission and the United Nations.
 *
 * Until now every disaster source here was American. USGS covers earthquakes
 * worldwide, and NWS and OpenFEMA stop at the US border, which left the feed
 * claiming to be about the world while reporting one country's weather.
 * GDACS is the piece that was missing: tropical cyclones, floods, droughts,
 * wildfires and volcanoes, anywhere, with a severity rating and a report page
 * per event.
 *
 * It is `official`. GDACS is an intergovernmental alerting system issuing its
 * own assessments, not an aggregator republishing someone else's reporting,
 * which is the distinction that separates it from the news sources here.
 *
 * Green alerts are dropped. GDACS issues them constantly — they are the
 * routine background of a planet with weather — and a feed that reports the
 * routine is a feed people stop reading, which costs them the one item that
 * mattered. Same rule the space-weather source follows for G1 storms.
 */

const ENDPOINT = 'https://www.gdacs.org/gdacsapi/api/Events/geteventlist/SEARCH';

/** Items kept. Finite by design — §5 forbids an endless feed. */
const LIMIT = 6;

export function queryUrl(): string {
  const params = new URLSearchParams({
    // Orange and Red only; Green is the routine background.
    alertlevel: 'Orange;Red',
    eventlist: 'EQ;TC;FL;DR;WF;VO',
  });
  return `${ENDPOINT}?${params.toString()}`;
}

/** GDACS event types, mapped onto the brief's narrow allow-list. */
const CATEGORY: Readonly<Record<string, Brief['category']>> = {
  EQ: 'disaster', // earthquake
  VO: 'disaster', // volcano
  FL: 'disaster', // flood
  WF: 'disaster', // wildfire
  TC: 'weather', // tropical cyclone
  DR: 'weather', // drought
};

const MEANS_FOR_YOU: Readonly<Record<string, string>> = {
  TC: 'A named storm at sea is a shipping and insurance event long before it is anything else. For a household outside its path the effect arrives as freight delays and prices, on a lag of weeks.',
  DR: 'Drought is the slowest of these and the one that reaches a kitchen most reliably. It shows up as food prices in the season after it, not the week after it.',
  FL: 'Flooding displaces people and closes roads and rail. At a distance the consequence is routes and supply rather than water.',
  WF: 'Fire at this scale affects air quality far beyond the burn, and closes the roads through it.',
  EQ: 'Distant quakes reach a household through supply routes and relatives, not through shaking.',
  VO: 'Ash closes airspace over a wide area, which is a travel and freight problem at any distance from the mountain.',
};

const DEFAULT_MEANS =
  'Context rather than an instruction. Events at this distance reach a household through supply chains and prices before they reach it any other way.';

interface GdacsFeed {
  readonly features?: ReadonlyArray<{
    readonly properties?: {
      readonly eventid?: string | number | null;
      readonly eventtype?: string | null;
      readonly eventname?: string | null;
      readonly name?: string | null;
      readonly description?: string | null;
      readonly alertlevel?: string | null;
      readonly fromdate?: string | null;
      readonly country?: string | null;
      readonly url?: { readonly report?: string | null } | null;
    };
  }>;
}

/** GDACS dates arrive without a zone. Read as UTC rather than as local. */
export function parseGdacsDate(raw: string | null | undefined): string | undefined {
  const text = (raw ?? '').trim();
  if (!text) return undefined;
  // Already zoned, or a bare `2026-10-29T14:00:00` the runner would otherwise
  // read in whatever timezone it happens to be set to.
  const candidate = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

export function parseGdacs(raw: unknown, limit: number = LIMIT): SourceResult {
  const rows = (raw as GdacsFeed)?.features;
  const features = Array.isArray(rows) ? rows : [];

  const brief: Brief[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    if (brief.length >= limit) break;
    const p = feature?.properties;
    if (!p) continue;

    // Belt and braces: the endpoint is asked for Orange and Red, and the
    // filter is applied again here so a change in its query semantics cannot
    // quietly fill the feed with routine alerts.
    const level = (p.alertlevel ?? '').trim().toLowerCase();
    if (level !== 'orange' && level !== 'red') continue;

    const type = (p.eventtype ?? '').trim().toUpperCase();
    const category = CATEGORY[type];
    if (!category) continue; // An event type we have no home for is not forced into one.

    const url = (p.url?.report ?? '').trim();
    const headline = (p.name ?? p.eventname ?? p.description ?? '').trim();
    const published = parseGdacsDate(p.fromdate);
    // Every one of these is mandatory downstream (§4.4). A record missing any
    // is dropped rather than published with a hole in it.
    if (!url.startsWith('https://') || !headline || !published) continue;

    const id = `gdacs-${type}-${String(p.eventid ?? url)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    brief.push({
      id,
      category,
      // Their words, not ours.
      headline,
      whatItMeansForYou: MEANS_FOR_YOU[type] ?? DEFAULT_MEANS,
      url,
      source: 'Global Disaster Alert and Coordination System',
      published,
      epistemicStatus: 'official',
      ...(p.country ? { where: p.country } : {}),
    });
  }

  // No signal. A red alert on another continent must not move a county's
  // readiness band, and wiring it in would make the band meaningless (D11).
  return { brief };
}

export async function collectGdacs(): Promise<SourceResult> {
  return parseGdacs(await getJson(queryUrl(), { retries: 1, backoffMs: 2_000 }));
}
