import { getText } from '../fetch';
import { blocks, tagText } from '../xml';
import type { SourceResult } from '../types';
import type { Brief } from '../schema';

/**
 * The FAA's National Airspace System status — ground stops, ground delay
 * programmes and airport closures, nationwide.
 *
 * The gap this fills was found the hard way. On 13 November 2026 the FAA
 * halted departures from every airport in the country after a
 * telecommunications outage at multiple Air Route Traffic Control Centres:
 * about 15,000 flights delayed or cancelled, hundreds more cancelled the next
 * day. This app's feed carried an M6.4 earthquake off Easter Island and
 * nothing about it. `infrastructure` existed as a category and only space
 * weather ever wrote to it, so the one event class that most reliably strands
 * a household away from home had no source at all.
 *
 * It is `official`, in the same sense GDACS is: the FAA is publishing the
 * operational state of a system it runs, not reporting on somebody else's.
 * That is the distinction that separates it from the press feeds, and it is
 * why this one may say a ground stop exists rather than that one is reported.
 *
 * NO SIGNAL, EVER. A nationwide ground stop does not change whether this
 * household has water, and the band is about readiness rather than about the
 * news (D11, D21). It is worth knowing and it is not an alert.
 *
 * ROUTINE IS DROPPED. There is always a delay somewhere; a feed that reports
 * the routine is a feed people stop reading, which costs them the one item
 * that mattered. Same rule the space-weather source follows for G1 storms and
 * GDACS for green alerts.
 */

/**
 * The FAA's own status endpoint, which is what `nasstatus.faa.gov` renders.
 *
 * UNVERIFIED AGAINST THE LIVE SERVICE. Nothing outbound was reachable from
 * the machine this was written on — faa.gov does not resolve there — so the
 * parser below is written to the documented shape and exercised against
 * recorded fixtures. Whether this URL answers, and whether its element names
 * are these, is for a run of the Sources check to say. The parser is
 * deliberately tolerant about the wrapper element names for that reason, and
 * a shape it cannot read is reported as a gap rather than passed off as a
 * quiet day.
 */
const ENDPOINT = 'https://nasstatus.faa.gov/api/airport-status-information';

/** The page a reader can check. §4.4: every item carries a canonical link. */
const CANONICAL = 'https://nasstatus.faa.gov/';

/**
 * How many airports under the same programme make it a systemic event.
 *
 * Below this, each airport is its own item: a ground stop at one field is a
 * fact about that field. At or above it, the airports stop being the story —
 * the system is — and the feed gets one line saying so instead of fourteen.
 * This is the case the FAA's nationwide stop would land in, and the reason
 * this collector summarises at all: a finite feed (§5) flooded by one event
 * is a feed with nothing else visible in it.
 */
const SYSTEMIC = 4;

/**
 * Ground delay programmes are the routine of this feed — there are usually
 * several, for weather, every day. One is not worth a reader's attention and
 * a dozen at once is, so they are only ever reported as a count, and only
 * when that count says something has gone wrong across the system.
 */
const SYSTEMIC_DELAYS = 6;

/** Items kept. Finite by design — §5 forbids an endless feed. */
const LIMIT = 4;

export interface AirportEntry {
  readonly airport: string;
  readonly reason?: string;
}

/**
 * The airports named inside one `<Delay_type>` block.
 *
 * Known wrapper names first, because that is what the documented feed uses.
 * The fallback exists because this was written without being able to fetch
 * the document: if the wrappers are named something else, every record is
 * still found by looking for the airport code itself and reading the fields
 * that follow it. A wrong guess about a wrapper name then costs nothing.
 */
export function entriesIn(section: string): AirportEntry[] {
  const found: AirportEntry[] = [];

  for (const wrapper of ['Program', 'Airport', 'Ground_Delay', 'Arrival_Departure_Delay']) {
    for (const record of blocks(section, wrapper)) {
      const airport = tagText(record, 'ARPT');
      if (airport) found.push({ airport, ...(tagText(record, 'Reason') ? { reason: tagText(record, 'Reason')! } : {}) });
    }
  }
  if (found.length > 0) return found;

  // Fallback: every airport code in the section, with the text that follows
  // it up to the next one treated as its record.
  const re = /<ARPT(?:\s[^>]*)?>([\s\S]*?)<\/ARPT>/gi;
  const starts: Array<{ code: string; from: number }> = [];
  let match = re.exec(section);
  while (match) {
    starts.push({ code: (match[1] ?? '').trim(), from: match.index + match[0].length });
    match = re.exec(section);
  }
  for (const [index, entry] of starts.entries()) {
    if (!entry.code) continue;
    const until = starts[index + 1]?.from ?? section.length;
    const reason = tagText(section.slice(entry.from, until), 'Reason');
    found.push({ airport: entry.code, ...(reason ? { reason } : {}) });
  }
  return found;
}

/** `<Delay_type>` blocks, by the `<Name>` the FAA gives each one. */
export function sections(xml: string): Map<string, string> {
  const byName = new Map<string, string>();
  for (const section of blocks(xml, 'Delay_type')) {
    const name = tagText(section, 'Name');
    if (name) byName.set(name.toLowerCase(), section);
  }
  return byName;
}

const MEANS_CLOSURE =
  'A closed field strands the people who were flying through it, not only the ones flying to it. If someone in your plan is travelling, this is the day to agree where they wait and how they check in.';
const MEANS_STOP =
  'A ground stop holds departures for the named airports. Flights already airborne continue; anything on the ground waits, and the delay outlasts the stop because crews and aircraft end the day in the wrong places.';
const MEANS_SYSTEMIC =
  'This is the whole system rather than one airport, which is the case worth having a plan for: assume anyone travelling is not arriving today, and that the backlog takes days rather than hours to clear.';

/**
 * The status document into brief items.
 *
 * Pure, and separate from fetching, because the endpoint is not reachable
 * from the machine this was written on: the parser is exercised against
 * recorded shapes and the first real run happens in CI.
 */
export function parseNasStatus(xml: string, now: Date, limit: number = LIMIT): Brief[] {
  const byName = sections(xml);
  const items: Brief[] = [];
  const stamp = now.toISOString();

  const find = (needle: string): string | undefined => {
    for (const [name, section] of byName) if (name.includes(needle)) return section;
    return undefined;
  };

  // Closures first. They are the rarest and the most consequential, and a
  // closed airport is a different kind of fact from a delayed one.
  const closures = entriesIn(find('closure') ?? '');
  for (const entry of closures) {
    if (items.length >= limit) break;
    items.push({
      id: `faa-closure-${entry.airport}`,
      category: 'infrastructure',
      headline: `${entry.airport} airport is closed${entry.reason ? `: ${entry.reason}` : ''}`,
      whatItMeansForYou: MEANS_CLOSURE,
      url: CANONICAL,
      source: 'Federal Aviation Administration',
      published: stamp,
      epistemicStatus: 'official',
    });
  }

  const stops = entriesIn(find('ground stop') ?? '');
  if (stops.length >= SYSTEMIC && items.length < limit) {
    // The airports are no longer the story. One line, naming the scale.
    items.push({
      id: 'faa-ground-stop-systemic',
      category: 'infrastructure',
      headline: `Departures held at ${stops.length} US airports`,
      whatItMeansForYou: MEANS_SYSTEMIC,
      url: CANONICAL,
      source: 'Federal Aviation Administration',
      published: stamp,
      epistemicStatus: 'official',
    });
  } else {
    for (const entry of stops) {
      if (items.length >= limit) break;
      items.push({
        id: `faa-ground-stop-${entry.airport}`,
        category: 'infrastructure',
        headline: `Departures held for ${entry.airport}${entry.reason ? `: ${entry.reason}` : ''}`,
        whatItMeansForYou: MEANS_STOP,
        url: CANONICAL,
        source: 'Federal Aviation Administration',
        published: stamp,
        epistemicStatus: 'official',
      });
    }
  }

  // Delay programmes are the routine here, so they only ever appear as a
  // count, and only when the count is itself the news.
  const delays = entriesIn(find('ground delay') ?? '');
  if (delays.length >= SYSTEMIC_DELAYS && items.length < limit) {
    items.push({
      id: 'faa-ground-delay-systemic',
      category: 'infrastructure',
      headline: `Ground delay programmes running at ${delays.length} US airports`,
      whatItMeansForYou: MEANS_SYSTEMIC,
      url: CANONICAL,
      source: 'Federal Aviation Administration',
      published: stamp,
      epistemicStatus: 'official',
    });
  }

  return items;
}

export async function collectFaa(now: Date): Promise<SourceResult> {
  const xml = await getText(ENDPOINT, { retries: 2 });

  // A document with no `<Delay_type>` in it is not this document. Thrown
  // rather than returned empty, so the runner records a gap instead of the
  // reader being shown an unusually calm day in American aviation.
  if (sections(xml).size === 0) {
    throw new Error(
      `${ENDPOINT}: no Delay_type sections in ${xml.length} bytes — the feed's shape has changed`,
    );
  }

  return { brief: parseNasStatus(xml, now) };
}
