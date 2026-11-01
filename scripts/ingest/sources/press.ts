import { getText, sleep } from '../fetch';
import { publisherFor } from '../publishers';
import type { SourceResult } from '../types';
import type { Brief } from '../schema';

/**
 * Publisher topic feeds, for unrest and conflict.
 *
 * GDELT was supposed to cover these and cannot: its rate limit is counted per
 * IP, CI runners share their egress with every other project's CI, and so the
 * category has been dark since it was built. No amount of politeness on our
 * side buys down a stranger's traffic. This is a second route to the same two
 * categories over a different host, so the two do not fail together.
 *
 * It is a narrower instrument than GDELT and the difference is worth stating
 * plainly: GDELT indexed the whole press and we filtered it down to an
 * allow-list, whereas this is one named outlet's own topic page. The selection
 * is that outlet's editorial judgement rather than a sweep of the wires. That
 * is a real limitation, which is why GDELT stays wired in alongside it — the
 * moment it is reachable from either host's egress, breadth comes back on its
 * own and these two overlapping is better than the category going dark again.
 *
 * What this inherits from the GDELT adapter, because it is the same editorial
 * floor and not a new one:
 *
 *   The publisher allow-list, now in ../publishers. Here it does a second job:
 *   a feed's links must point back at the publisher whose feed it is, so a
 *   hijacked or syndicated feed cannot inject links to somewhere else.
 *
 *   Everything is `press-reported`. Never `official`. These are news reports
 *   about events, not primary documents, and the one thing this surface must
 *   never do is dress reporting as a government source.
 *
 *   The category is a fact about which feed an item came from rather than a
 *   guess made by running a regex over a headline.
 */

export interface FeedSpec {
  readonly category: Brief['category'];
  /** The publisher's own name for the topic, used in the failure report. */
  readonly topic: string;
  readonly url: string;
}

/**
 * The feeds, by topic.
 *
 * A publisher's tag feed is not an API and carries no stability promise: a
 * desk can retire a tag whenever it likes, and the URL then 404s or starts
 * answering with a search page. So a feed that fails is skipped and named in
 * the run report rather than taking the others down with it, and the list
 * above is expected to need pruning over time rather than to stay correct.
 */
export const FEEDS: readonly FeedSpec[] = [
  { category: 'unrest', topic: 'Protest', url: 'https://www.theguardian.com/world/protest/rss' },
  {
    category: 'unrest',
    topic: 'Civil unrest',
    url: 'https://www.theguardian.com/world/civil-unrest/rss',
  },
  { category: 'unrest', topic: 'Riots', url: 'https://www.theguardian.com/world/riots/rss' },
  { category: 'conflict', topic: 'Conflict', url: 'https://www.theguardian.com/world/conflict/rss' },
  {
    category: 'conflict',
    topic: 'Armed forces',
    url: 'https://www.theguardian.com/world/armed-forces/rss',
  },
];

/** Items kept per category. Finite by design — §5 forbids an endless feed. */
const PER_CATEGORY = 3;

/**
 * How old an item may be and still be worth a reader's attention.
 *
 * GDELT was asked for 24 hours. A tag feed is slower than an index of the
 * whole press — a quiet week on one desk is a feed with nothing new in it —
 * so this is wider, at the cost of the occasional item the reader saw
 * yesterday. The card states its own age either way.
 */
const MAX_AGE_HOURS = 48;

/** Polite spacing between requests to one publisher. */
const SPACING_MS = 1_500;

const MEANS_FOR_YOU: Readonly<Record<string, string>> = {
  unrest:
    'Context rather than an instruction. Disorder somewhere else reaches a household through prices, shipping and travel long before it reaches it any other way.',
  conflict:
    'Context rather than an instruction. Conflict reaches a household through fuel, shipping and food prices first, and the lead time on those is weeks rather than days.',
};

/** The five XML entities, plus numeric escapes. Nothing else is interpreted. */
export function decodeXml(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Ampersand last, so `&amp;lt;` decodes to the text `&lt;` rather than to
    // a tag bracket. Decoding it first would let an encoded entity escape.
    .replace(/&amp;/g, '&');
}

/** The inner text of each `<tag>…</tag>`, in document order. */
export function blocks(xml: string, tag: string): string[] {
  const found: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  let match = re.exec(xml);
  while (match) {
    found.push(match[1] ?? '');
    match = re.exec(xml);
  }
  return found;
}

/**
 * The text of the first `<tag>` in a block, CDATA unwrapped and decoded.
 *
 * Self-closing tags are deliberately not matched: `<title/>` has no text, and
 * treating it as empty string rather than as absent would hide a feed that
 * has changed shape behind an item that silently fails validation later.
 */
export function tagText(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = re.exec(block);
  if (!match) return undefined;
  const raw = (match[1] ?? '').trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw);
  const text = cdata ? (cdata[1] ?? '') : decodeXml(raw);
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : undefined;
}

/**
 * The item's canonical link, from either feed dialect.
 *
 * RSS puts it in the text of `<link>`; Atom puts it in the `href` of a
 * self-closing `<link>`, where `rel="alternate"` (or no rel at all) is the
 * human-readable page and the others are not.
 */
export function itemLink(block: string): string | undefined {
  const rss = tagText(block, 'link');
  if (rss?.startsWith('http')) return rss;

  const re = /<link\b([^>]*)\/?>/gi;
  let match = re.exec(block);
  while (match) {
    const attrs = match[1] ?? '';
    const rel = /\brel\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1]?.toLowerCase();
    const href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1];
    if (href && (rel === undefined || rel === 'alternate')) return decodeXml(href.trim());
    match = re.exec(block);
  }
  return undefined;
}

/** RSS `pubDate` is RFC-822, Atom's dates are ISO. Both parse; neither is trusted. */
export function itemDate(block: string): string | undefined {
  for (const tag of ['pubDate', 'published', 'updated', 'dc:date']) {
    const raw = tagText(block, tag);
    if (!raw) continue;
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return undefined;
}

/**
 * One feed's XML into brief items.
 *
 * Pure, and separate from fetching, because the feeds are not reachable from
 * the machine this was written on: the parser is exercised against recorded
 * shapes and the first real run happens in CI.
 */
export function parseFeed(
  xml: string,
  feed: FeedSpec,
  now: Date,
  limit: number = PER_CATEGORY,
): Brief[] {
  // Either dialect. An RSS feed has <item>, an Atom feed has <entry>.
  const entries = [...blocks(xml, 'item'), ...blocks(xml, 'entry')];
  const items: Brief[] = [];
  const cutoff = now.getTime() - MAX_AGE_HOURS * 3_600_000;

  for (const block of entries) {
    if (items.length >= limit) break;

    const headline = tagText(block, 'title');
    const url = itemLink(block);
    const published = itemDate(block);
    if (!headline || !url || !published) continue;

    // https specifically: a claim the reader cannot check is one that is
    // asking to be trusted, and a http link is one a network can rewrite.
    if (!url.startsWith('https://')) continue;

    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }

    // The editorial floor, doing its second job: the link has to point back
    // at an allow-listed publisher, so a hijacked or syndicated feed cannot
    // put an arbitrary destination on this surface.
    const source = publisherFor(host);
    if (!source) continue;

    const at = Date.parse(published);
    if (Number.isNaN(at) || at < cutoff || at > now.getTime() + 3_600_000) continue;

    items.push({
      id: `press-${feed.category}-${url}`,
      category: feed.category,
      // Their headline, not ours. Never rewritten, never sharpened.
      headline,
      whatItMeansForYou: MEANS_FOR_YOU[feed.category] ?? MEANS_FOR_YOU['unrest']!,
      url,
      source,
      published,
      epistemicStatus: 'press-reported',
    });
  }

  return items;
}

/**
 * Fetch every feed, keep what answers, and name what did not.
 *
 * No signal, ever. Unrest on the other side of the world does not move a
 * household's readiness state, and wiring a news feed into the band would be
 * the fastest possible way to make the band meaningless (D11, D21).
 */
export async function collectPress(
  onNote: (line: string) => void = () => {},
): Promise<SourceResult> {
  const brief: Brief[] = [];
  const perCategory = new Map<string, number>();
  const seenTitles = new Set<string>();
  const now = new Date();
  let answered = 0;

  for (const [index, feed] of FEEDS.entries()) {
    if (index > 0) await sleep(SPACING_MS);

    let xml: string;
    try {
      xml = await getText(feed.url, { retries: 1 });
    } catch (error) {
      // Named, not swallowed. A tag that has been retired upstream should be
      // visible in the run report as the thing to delete from FEEDS.
      onNote(`press/${feed.topic}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const parsed = parseFeed(xml, feed, now, PER_CATEGORY);
    if (parsed.length === 0) {
      // A feed that answers with no usable item is as much of a problem as one
      // that 404s, and far easier to miss.
      onNote(`press/${feed.topic}: answered with no usable item (${xml.length} bytes)`);
      continue;
    }
    answered += 1;

    for (const item of parsed) {
      const taken = perCategory.get(item.category) ?? 0;
      if (taken >= PER_CATEGORY) break;
      // The same story runs across two tag feeds within minutes. One is enough.
      const key = item.headline.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      perCategory.set(item.category, taken + 1);
      brief.push(item);
    }
  }

  if (answered === 0) {
    // Every feed failed. Thrown rather than returned empty, so the runner
    // records the source as unreachable and the reader is told the category
    // is missing instead of being shown a quiet day that was not one.
    throw new Error(`no publisher feed answered (${FEEDS.length} tried)`);
  }

  return { brief };
}
