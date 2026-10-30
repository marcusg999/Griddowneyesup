import { getJson } from '../fetch';
import type { SourceResult } from '../types';
import type { Signal } from '../schema';

/**
 * OpenFEMA disaster declarations, by state.
 *
 * Declarations are slow — days to weeks — which is why this is a signal with a
 * long freshness window rather than a Worth-knowing card. A declaration is
 * also the one signal here that is unambiguously good news as well as bad: it
 * is the moment federal money and logistics are released.
 */

interface FemaResponse {
  readonly DisasterDeclarationsSummaries?: ReadonlyArray<{
    readonly disasterNumber?: number | null;
    readonly declarationDate?: string | null;
    readonly incidentType?: string | null;
    readonly declarationTitle?: string | null;
    readonly state?: string | null;
  }>;
}

/** Still live if declared within this window. Declarations have no clean end. */
const RECENT_DAYS = 45;

export function parseOpenFema(raw: unknown, state: string, now: Date): SourceResult {
  const rows = (raw as FemaResponse)?.DisasterDeclarationsSummaries;
  const declarations = Array.isArray(rows) ? rows : [];

  const recent = declarations.filter((d) => {
    if (!d?.declarationDate) return false;
    const age = now.getTime() - Date.parse(d.declarationDate);
    return Number.isFinite(age) && age >= 0 && age < RECENT_DAYS * 86_400_000;
  });

  const titles = [
    ...new Set(
      recent
        .map((d) => d.declarationTitle ?? d.incidentType)
        .filter((t): t is string => Boolean(t)),
    ),
  ].slice(0, 3);

  const signal: Signal = {
    source: 'openfema',
    sourceName: 'OpenFEMA',
    level: recent.length > 0 ? 'elevated' : 'quiet',
    headline:
      recent.length > 0
        ? `Active federal declaration: ${titles.join('; ')}`
        : 'No federal disaster declaration for this state in the last 45 days',
    meansForYou:
      recent.length > 0
        ? 'A declaration means federal assistance is available, which is worth knowing whether or not you were affected — individual assistance has deadlines.'
        : 'Nothing to act on.',
    url: 'https://www.fema.gov/disaster/declarations',
    observedAt: now.toISOString(),
  };

  return { signal };
}

export async function collectOpenFema(state: string, now: Date): Promise<SourceResult> {
  const url =
    'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries' +
    `?$filter=state%20eq%20'${encodeURIComponent(state)}'` +
    '&$orderby=declarationDate%20desc&$top=20';
  return parseOpenFema(await getJson(url, { retries: 1, backoffMs: 2_000 }), state, now);
}
