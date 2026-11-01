/**
 * Publishers whose reporting may appear on a readiness surface.
 *
 * Deliberately short and deliberately boring. Wire services first, because a
 * wire report is the closest thing to a primary source that journalism has.
 * The rest are outlets with a standing foreign desk and a published
 * corrections policy. The value of the list is what it leaves out.
 *
 * This lives apart from any one adapter because two sources now consult it —
 * the GDELT index, which needs it to decide what to keep, and the publisher
 * feeds, which need it to check that a feed's links still point at the
 * publisher whose feed it is. One editorial floor, in one file; two copies
 * would be two places for an outlet to be admitted by accident.
 */
export const PUBLISHERS: Readonly<Record<string, string>> = {
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
 * The publisher for a host, or undefined if it is not on the list.
 *
 * `www.` and other leading labels are stripped so the list stays readable. A
 * subdomain of an allow-listed publisher is that publisher, matched on a label
 * boundary so `reuters.com.example.net` is not Reuters.
 */
export function publisherFor(domain: string | null | undefined): string | undefined {
  const host = (domain ?? '').trim().toLowerCase().replace(/^www\./, '');
  if (!host) return undefined;
  if (PUBLISHERS[host]) return PUBLISHERS[host];
  for (const [allowed, name] of Object.entries(PUBLISHERS)) {
    if (host.endsWith(`.${allowed}`)) return name;
  }
  return undefined;
}
