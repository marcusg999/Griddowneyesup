import { getText, sleep, SourceError } from '../fetch';
import type { SourceResult } from '../types';
import type { Brief } from '../schema';

/**
 * GDELT, for unrest and conflict — the categories no government feed covers.
 *
 * ReliefWeb used to carry these. Its v1 is retired (410) and its v2 refuses an
 * unregistered `appname` (403), which left the brief with earthquakes and
 * nothing else. GDELT needs no key and indexes world news in near real time,
 * so it can fill the gap. The problem is that it indexes ALL of it.
 *
 * That is the whole design tension here. §5 says this must never become a news
 * app, and §4.4 requires a named publisher and a canonical link on every item.
 * An unfiltered GDELT query satisfies neither: it would return aggregator
 * reprints, content farms and partisan outlets alongside the wires, attributed
 * to a bare domain.
 *
 * So the editorial floor is a publisher allow-list, enforced here:
 *
 *   A domain not on the list is dropped. Not down-ranked — dropped. This is
 *   the difference between "a news feed" and "a short list of wire reports",
 *   and it is the only reason this source is admissible at all.
 *
 *   The allow-list is wire services and outlets with published corrections
 *   policies and foreign desks. It names each one, which is what turns a
 *   `domain` field into the attribution §4.4 asks for.
 *
 *   Everything is `press-reported`. Never `official`. These are news reports
 *   about events, not primary documents, and the one thing this surface must
 *   never do is dress reporting as a government source.
 *
 * The queries are per category rather than one broad query, so an item's
 * category is a fact about which query found it rather than a guess made by
 * running a regex over a headline.
 */

/**
 * Publishers whose reporting may appear on a readiness surface.
 *
 * Deliberately short and deliberately boring. Wire services first, because a
 * wire report is the closest thing to a primary source that journalism has.
 * The rest are outlets with a standing foreign desk and a published
 * corrections policy. The value of the list is what it leaves out.
 */
const PUBLISHERS: Readonly<Record<string, string>> = {
  'reuters.com': 'Reuters',
  'apnews.com': 'Associated Press',
  'afp.com': 'Agence France-Presse',
  'bbc.com': 'BBC News',
  'bbc.co.uk': 'BBC News',
  'aljazeera.com': 'Al Jazeera',
  'theguardian.com': 'The Guardian',
  'npr.org': 'NPR',
  'pbs.org': 'PBS NewsHour',
  'dw.com': 'Deutsche Welle',
  'france24.com': 'France 24',
  'cbc.ca': 'CBC News',
  'abc.net.au': 'ABC News (Australia)',
  'nytimes.com': 'The New York Times',
  'washingtonpost.com': 'The Washington Post',
  'wsj.com': 'The Wall Street Journal',
  'ft.com': 'Financial Times',
  'economist.com': 'The Economist',
  'bloomberg.com': 'Bloomberg',
  'cnn.com': 'CNN',
  'nbcnews.com': 'NBC News',
  'cbsnews.com': 'CBS News',
  'abcnews.go.com': 'ABC News',
  'scmp.com': 'South China Morning Post',
  'thehindu.com': 'The Hindu',
  'timesofindia.indiatimes.com': 'The Times of India',
  'japantimes.co.jp': 'The Japan Times',
  'haaretz.com': 'Haaretz',
  'kyivindependent.com': 'The Kyiv Independent',
};

/**
 * Two queries, one per category. `theme:` filters on GDELT's own GKG themes,
 * which are assigned by their pipeline rather than by us matching words.
 *
 * `sourcelang:english` because every one of the allow-listed publishers has an
 * English edition, and a headline we cannot read is a headline we cannot
 * vouch for.
 */
/**
 * No domain clause. One OR group is all GDELT accepts.
 *
 * The evidence is specific. `(theme:PROTEST OR theme:UNREST_POLICEBRUTALITY)
 * sourcelang:english` worked — it returned 75 articles. Adding a second
 * parenthesised group for publishers got `Your query ...` back as plain text
 * with an HTTP 200, which is how GDELT rejects a query. Two OR groups is the
 * only thing that changed, so one is the limit.
 *
 * Given the choice of which group to spend, the themes win. Narrowing by
 * publisher would mean one request per publisher — GDELT accepts a single
 * bare `domain:` alongside one OR group, but not a group of them — and GDELT
 * throttles hard enough that ten requests a day is a worse bet than two.
 *
 * So the request is wide, `maxrecords` goes to GDELT's documented maximum,
 * and PUBLISHERS above stays the only filter on who gets republished. That
 * gives it 250 candidates per category to find a wire report among rather
 * than 75.
 */

export const QUERIES: ReadonlyArray<{
  readonly category: Brief['category'];
  readonly query: string;
}> = [
  {
    // Political protest, riot and civil unrest, worldwide. Four of GDELT's
    // own GKG themes rather than one: PROTEST alone misses the things a
    // household would recognise as unrest. MOLOTOVCOCKTAIL is their theme
    // name, not ours, and it is what rioting is indexed under.
    category: 'unrest',
    query:
      '(theme:PROTEST OR theme:UNREST_POLICEBRUTALITY OR theme:UNREST_STRIKE OR theme:UNREST_MOLOTOVCOCKTAIL) sourcelang:english',
  },
  {
    category: 'conflict',
    query: '(theme:ARMEDCONFLICT OR theme:MILITARY_ESCALATION) sourcelang:english',
  },
];

/** Items kept per category. Finite by design — §5 forbids an endless feed. */
const PER_CATEGORY = 3;

const ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';

export function queryUrl(query: string): string {
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    // GDELT's documented maximum. The allow-list is the only filter on
    // publisher, and it discarded all 75 of the first run's articles, so the
    // thing it most needs is more candidates to find a wire report among.
    maxrecords: '250',
    timespan: '24h',
    sort: 'datedesc',
  });
  return `${ENDPOINT}?${params.toString()}`;
}

interface GdeltResponse {
  readonly articles?: ReadonlyArray<{
    readonly url?: string | null;
    readonly title?: string | null;
    readonly seendate?: string | null;
    readonly domain?: string | null;
    readonly language?: string | null;
    readonly sourcecountry?: string | null;
  }>;
}

/**
 * GDELT returns `seendate` as a compact UTC stamp: `20260601T120000Z`. Parsed
 * explicitly rather than handed to `Date.parse`, which does not accept it and
 * would hand back an Invalid Date that only fails later, at the schema.
 */
export function parseSeenDate(raw: string | null | undefined): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec((raw ?? '').trim());
  if (!m) return undefined;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

/** `www.` and other leading labels are stripped so the list stays readable. */
export function publisherFor(domain: string | null | undefined): string | undefined {
  const host = (domain ?? '').trim().toLowerCase().replace(/^www\./, '');
  if (!host) return undefined;
  if (PUBLISHERS[host]) return PUBLISHERS[host];
  // A subdomain of an allow-listed publisher is that publisher. Matched on a
  // label boundary so `reuters.com.example.net` is not Reuters.
  for (const [allowed, name] of Object.entries(PUBLISHERS)) {
    if (host.endsWith(`.${allowed}`)) return name;
  }
  return undefined;
}

const MEANS_FOR_YOU: Readonly<Record<string, string>> = {
  unrest:
    'Context rather than an instruction. Disorder somewhere else reaches a household through prices, shipping and travel long before it reaches it any other way.',
  conflict:
    'Context rather than an instruction. Conflict reaches a household through fuel, shipping and food prices first, and the lead time on those is weeks rather than days.',
};

export function parseGdelt(
  raw: unknown,
  category: Brief['category'],
  limit: number = PER_CATEGORY,
): SourceResult {
  const rows = (raw as GdeltResponse)?.articles;
  const articles = Array.isArray(rows) ? rows : [];

  const brief: Brief[] = [];
  const seenTitles = new Set<string>();

  for (const article of articles) {
    if (brief.length >= limit) break;

    // The editorial floor. An unrecognised domain is dropped, not kept with a
    // bare hostname for attribution.
    const source = publisherFor(article?.domain);
    if (!source) continue;

    const published = parseSeenDate(article?.seendate);
    const title = article?.title?.trim();
    const url = article?.url?.trim();
    // https specifically: a claim the reader cannot check is one that is
    // asking to be trusted, and a http link is one a network can rewrite.
    if (!title || !url || !url.startsWith('https://') || !published) continue;

    // The same story runs on several wires within minutes. One is enough.
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    brief.push({
      id: `gdelt-${category}-${url}`,
      category,
      // Their headline, not ours. Never rewritten, never sharpened.
      headline: title,
      whatItMeansForYou: MEANS_FOR_YOU[category] ?? MEANS_FOR_YOU['unrest']!,
      url,
      source,
      published,
      epistemicStatus: 'press-reported',
      ...(article?.sourcecountry ? { where: article.sourcecountry } : {}),
    });
  }

  // No signal, ever. Unrest on the other side of the world does not move a
  // household's readiness state, and wiring a news feed into the band would be
  // the fastest possible way to make the band meaningless (D11, D21).
  return { brief };
}

/**
 * GDELT's own stated limit, in their own words from a 429 body:
 *
 *   "Please limit requests to one every 5 seconds or contact [...] for larger
 *   queries. All high-traffic users should switch to our ngrams dataset"
 *
 * Five seconds is the floor, so the spacing below clears it threefold and the
 * backoff starts well above it. That our requests still get 429'd says the
 * limit is counted per IP and CI runners share their egress with every other
 * project's CI — we are queueing behind strangers rather than being refused,
 * and no amount of politeness on our side buys down someone else's traffic.
 *
 * Patient rather than brisk, because this runs once a day and four minutes of
 * waiting is free where a wrongly-recorded dead source is not. Worst case is
 * 15 + 30 + 60 + 120 seconds on the first query, which still leaves room
 * inside both hosts' build timeouts.
 *
 * It may still fail, and that is survivable: the digest publishes with a named
 * gap and the report says which source and why. The durable fixes are outside
 * this file — a different egress (the Netlify build is on one), or the contact
 * address GDELT offers for larger queries.
 */
const SPACING_MS = 15_000;
const RETRIES = 4;
const BACKOFF_MS = 15_000;

/**
 * GDELT reports a bad query as plain text with an HTTP 200, so a JSON parser
 * sees it as a syntax error and the actual complaint — which is a sentence in
 * English explaining what is wrong — gets thrown away. Read the text, decide
 * whether it is JSON, and if it is not, report what they said.
 */
export function parseResponse(text: string, url: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw new SourceError(`${url}: response looked like JSON and was not`);
    }
  }
  // Their own words, which is the whole point of this function.
  throw new SourceError(`${url}: GDELT refused the query — ${trimmed.slice(0, 200)}`);
}

export async function collectGdelt(): Promise<SourceResult> {
  const brief: Brief[] = [];

  for (const [index, { category, query }] of QUERIES.entries()) {
    // Sequentially and spaced, rather than in parallel: two polite requests
    // beat two simultaneous ones against a free public endpoint.
    if (index > 0) await sleep(SPACING_MS);
    const url = queryUrl(query);
    const text = await getText(url, { retries: RETRIES, backoffMs: BACKOFF_MS });
    brief.push(...(parseGdelt(parseResponse(text, url), category).brief ?? []));
  }

  return { brief };
}
