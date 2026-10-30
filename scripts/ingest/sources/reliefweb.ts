import { getJson } from '../fetch';
import type { SourceResult } from '../types';
import type { Brief } from '../schema';

/**
 * ReliefWeb, for the part of the world picture no government API covers.
 *
 * The five other sources are structured US government feeds. Unrest, conflict
 * and the strikes the brief is meant to carry have no equivalent: there is no
 * free, authoritative, machine-readable feed of "what is happening in the
 * world that a household should know about".
 *
 * ReliefWeb is a UN OCHA service that aggregates humanitarian reporting. Every
 * item carries a named publisher and a canonical URL, which is what makes it
 * usable here at all: we republish someone else's headline with attribution
 * and a link, and never write one ourselves (§4.4).
 *
 * It is marked `press-reported` rather than `official`, because most of what
 * it carries is reporting rather than a primary document — and the one thing
 * this surface must never do is dress reporting as a government source.
 */

// v2, not v1. The first live run in CI got `HTTP 410 Gone` from /v1/reports:
// the version is decommissioned, not having a bad afternoon. v2 is documented
// as compatible with v1, so the query below is unchanged.
//
// `appname` identifies the caller and must be one ReliefWeb has registered —
// an unregistered value is refused with a 403, which is what the earlier
// `ballast-preparedness` got. It is not a credential: it travels in the query
// string and appears in every log, so it belongs in the source rather than in
// a secret store. Overridable by environment variable all the same, so it can
// be changed without a release.
const APPNAME = (process.env['RELIEFWEB_APPNAME'] ?? '').trim() || 'awareness';

const API =
  'https://api.reliefweb.int/v2/reports' +
  `?appname=${encodeURIComponent(APPNAME)}` +
  '&profile=list&limit=12&sort[]=date.created:desc' +
  '&filter[operator]=OR' +
  '&filter[conditions][0][field]=disaster_type.name' +
  '&filter[conditions][0][value][]=Flood' +
  '&filter[conditions][0][value][]=Earthquake' +
  '&filter[conditions][0][value][]=Tropical%20Cyclone' +
  '&filter[conditions][0][value][]=Drought' +
  '&filter[conditions][0][value][]=Wild%20Fire' +
  '&filter[conditions][1][field]=theme.name' +
  '&filter[conditions][1][value][]=Protection%20and%20Human%20Rights';

interface ReliefWebResponse {
  readonly data?: ReadonlyArray<{
    readonly id?: string | number;
    readonly fields?: {
      readonly title?: string | null;
      readonly url?: string | null;
      readonly date?: { readonly created?: string | null } | null;
      readonly source?: ReadonlyArray<{ readonly name?: string | null }> | null;
      readonly disaster_type?: ReadonlyArray<{ readonly name?: string | null }> | null;
      readonly country?: ReadonlyArray<{ readonly name?: string | null }> | null;
    };
  }>;
}

/** Map what the item is about onto the brief's narrow allow-list. */
function categorise(disasterTypes: readonly string[], title: string): Brief['category'] {
  if (disasterTypes.length > 0) return 'disaster';
  const t = title.toLowerCase();
  if (/(protest|unrest|riot|demonstration)/.test(t)) return 'unrest';
  if (/(strike|airstrike|missile|offensive|shelling|conflict|war)/.test(t)) return 'conflict';
  return 'unrest';
}

export function parseReliefWeb(raw: unknown): SourceResult {
  const rows = (raw as ReliefWebResponse)?.data;
  const items = Array.isArray(rows) ? rows : [];

  const brief: Brief[] = [];
  for (const row of items) {
    const f = row?.fields;
    const published = f?.date?.created;
    // Mandatory downstream: headline, link, date, named source. Anything
    // missing one is dropped rather than published with a gap.
    if (!f?.title || !f.url || !published) continue;

    const source = f.source?.[0]?.name;
    if (!source) continue;

    // Annotated rather than inferred: `?? []` widens to never[] against a
    // nullable readonly array and the callbacks lose their parameter types.
    const named = (list: ReadonlyArray<{ readonly name?: string | null }> | null | undefined) =>
      (list ?? []).map((entry) => entry?.name).filter((n): n is string => Boolean(n));

    const disasterTypes = named(f.disaster_type);
    const where = named(f.country).slice(0, 2).join(', ');

    brief.push({
      id: `reliefweb-${String(row.id ?? f.url)}`,
      category: categorise(disasterTypes, f.title),
      // Their headline, not ours.
      headline: f.title,
      whatItMeansForYou:
        'Context rather than an instruction. Events at this distance reach a household through supply chains and prices before they reach it any other way.',
      url: f.url,
      source,
      published,
      epistemicStatus: 'press-reported',
      ...(where ? { where } : {}),
    });
  }

  return { brief };
}

export async function collectReliefWeb(): Promise<SourceResult> {
  return parseReliefWeb(await getJson(API, { retries: 1, backoffMs: 2_000 }));
}
