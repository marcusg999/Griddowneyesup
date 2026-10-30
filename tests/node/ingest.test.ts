import { describe, expect, it } from 'vitest';
import { briefSchema, signalSchema } from '../../scripts/ingest/schema';
import { postureSchema } from '../../scripts/schema';
import { parseGdacs, parseGdacsDate } from '../../scripts/ingest/sources/gdacs';
import { ensoState, parseEnso, parseOni } from '../../scripts/ingest/sources/enso';
import { parseGdelt, parseSeenDate, queryUrl } from '../../scripts/ingest/sources/gdelt';
import { parseNws } from '../../scripts/ingest/sources/nws';
import { parseOpenFema } from '../../scripts/ingest/sources/openfema';
import { parseReliefWeb } from '../../scripts/ingest/sources/reliefweb';
import { parseSwpc } from '../../scripts/ingest/sources/swpc';
import { parseUsgs } from '../../scripts/ingest/sources/usgs';

/**
 * Parser tests for the ingester.
 *
 * An honest note on what these do and do not prove. The fixtures below are
 * written from each API's published schema, not captured from a live call —
 * the machine these were written on cannot reach any of the six hosts. So they
 * prove the parsers handle the documented shape, the degenerate shapes, and
 * the malformed ones. They do not prove the documented shape is what the API
 * actually returns today. Only a real run does that, and it happens in CI.
 *
 * Which is why the tests that matter most here are the ones about missing and
 * malformed data: those are the cases a schema drift will arrive as, and the
 * requirement is that the parser drops the record rather than publishing
 * something with a hole in it.
 */

const NOW = new Date('2026-06-01T12:00:00.000Z');
const hoursAgo = (h: number) => NOW.getTime() - h * 3_600_000;

describe('USGS', () => {
  const feed = {
    features: [
      {
        id: 'us7000abcd',
        properties: {
          mag: 6.2,
          place: '114 km SSW of Example, Chile',
          time: hoursAgo(5),
          url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd',
          title: 'M 6.2 - 114 km SSW of Example, Chile',
          tsunami: 0,
        },
      },
    ],
  };

  it('turns an event into a card with the source own title and event page', () => {
    const { brief } = parseUsgs(feed, NOW);
    expect(brief).toHaveLength(1);
    expect(brief?.[0]?.headline).toBe('M 6.2 - 114 km SSW of Example, Chile');
    expect(brief?.[0]?.url).toContain('/eventpage/');
    expect(brief?.[0]?.category).toBe('disaster');
    expect(briefSchema.safeParse(brief?.[0]).success).toBe(true);
  });

  it('says so when a tsunami evaluation was triggered', () => {
    const tsunami = { features: [{ ...feed.features[0], properties: { ...feed.features[0]!.properties, tsunami: 1 } }] };
    expect(parseUsgs(tsunami, NOW).brief?.[0]?.whatItMeansForYou).toMatch(/tsunami/i);
  });

  it('raises the signal only for events inside 24 hours', () => {
    expect(parseUsgs(feed, NOW).signal?.level).toBe('elevated');
    const old = { features: [{ ...feed.features[0], properties: { ...feed.features[0]!.properties, time: hoursAgo(72) } }] };
    expect(parseUsgs(old, NOW).signal?.level).toBe('quiet');
  });

  it('drops a record missing its link or title rather than publishing a gap', () => {
    const broken = {
      features: [
        { properties: { title: 'No link', time: hoursAgo(1) } },
        { properties: { url: 'https://example.gov/x', time: hoursAgo(1) } },
        { properties: { url: 'https://example.gov/y', title: 'No time' } },
      ],
    };
    expect(parseUsgs(broken, NOW).brief).toHaveLength(0);
  });

  it('survives a response that is not the shape at all', () => {
    for (const junk of [null, undefined, {}, { features: 'not an array' }, []]) {
      expect(() => parseUsgs(junk, NOW)).not.toThrow();
      expect(parseUsgs(junk, NOW).brief).toEqual([]);
    }
  });
});

describe('NWS', () => {
  const alerts = (severity: string, event = 'Flood Warning') => ({
    features: [{ properties: { event, severity, urgency: 'Expected', areaDesc: 'San Francisco' } }],
  });

  it('maps severity onto the three levels the band understands', () => {
    expect(parseNws(alerts('Severe'), 'CA', NOW).signal?.level).toBe('active');
    expect(parseNws(alerts('Moderate'), 'CA', NOW).signal?.level).toBe('elevated');
    expect(parseNws(alerts('Minor'), 'CA', NOW).signal?.level).toBe('quiet');
    expect(parseNws({ features: [] }, 'CA', NOW).signal?.level).toBe('quiet');
  });

  it('names the events rather than counting them', () => {
    // "3 alerts" tells a reader nothing about whether to keep reading.
    const two = {
      features: [
        { properties: { event: 'Flood Warning', severity: 'Severe' } },
        { properties: { event: 'Wind Advisory', severity: 'Minor' } },
      ],
    };
    expect(parseNws(two, 'CA', NOW).signal?.headline).toBe('Flood Warning, Wind Advisory');
  });

  it('produces a valid signal from junk', () => {
    const signal = parseNws({ nonsense: true }, 'CA', NOW).signal;
    expect(signalSchema.safeParse(signal).success).toBe(true);
    expect(signal?.level).toBe('quiet');
  });
});

describe('SWPC', () => {
  const scales = (g: string) => ({ '0': { R: { Scale: '0' }, S: { Scale: '0' }, G: { Scale: g } } });

  it('reads the current block, which is keyed "0" rather than being first', () => {
    expect(parseSwpc(scales('4'), NOW).signal?.level).toBe('active');
    expect(parseSwpc(scales('1'), NOW).signal?.level).toBe('elevated');
    expect(parseSwpc(scales('0'), NOW).signal?.level).toBe('quiet');
  });

  it('only writes a card when it is genuinely notable', () => {
    // A G1 every other week is how a feed teaches people to stop reading it.
    expect(parseSwpc(scales('1'), NOW).brief).toHaveLength(0);
    expect(parseSwpc(scales('3'), NOW).brief).toHaveLength(1);
    expect(briefSchema.safeParse(parseSwpc(scales('3'), NOW).brief?.[0]).success).toBe(true);
  });

  it('treats a non-numeric scale as zero rather than NaN', () => {
    expect(parseSwpc({ '0': { G: { Scale: 'unknown' } } }, NOW).signal?.level).toBe('quiet');
  });
});

describe('OpenFEMA', () => {
  const declared = (daysAgo: number) => ({
    DisasterDeclarationsSummaries: [
      {
        disasterNumber: 4812,
        declarationDate: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
        incidentType: 'Fire',
        declarationTitle: 'WILDFIRES',
        state: 'CA',
      },
    ],
  });

  it('counts a declaration as live inside the window and not outside it', () => {
    expect(parseOpenFema(declared(10), 'CA', NOW).signal?.level).toBe('elevated');
    expect(parseOpenFema(declared(90), 'CA', NOW).signal?.level).toBe('quiet');
  });

  it('ignores a declaration dated in the future', () => {
    expect(parseOpenFema(declared(-5), 'CA', NOW).signal?.level).toBe('quiet');
  });

  it('produces a valid signal when the list is empty or absent', () => {
    for (const raw of [{ DisasterDeclarationsSummaries: [] }, {}, null]) {
      expect(signalSchema.safeParse(parseOpenFema(raw, 'CA', NOW).signal).success).toBe(true);
    }
  });
});

describe('ReliefWeb', () => {
  const report = (title: string, extra: Record<string, unknown> = {}) => ({
    data: [
      {
        id: 4242,
        fields: {
          title,
          url: 'https://reliefweb.int/report/example/abc',
          date: { created: '2026-05-30T08:00:00+00:00' },
          source: [{ name: 'UN OCHA' }],
          ...extra,
        },
      },
    ],
  });

  it('republishes the publisher headline and link, never one of ours', () => {
    const { brief } = parseReliefWeb(report('Floods displace thousands in Example'));
    expect(brief?.[0]?.headline).toBe('Floods displace thousands in Example');
    expect(brief?.[0]?.source).toBe('UN OCHA');
    expect(brief?.[0]?.url).toContain('reliefweb.int/report');
  });

  it('marks everything press-reported, never official', () => {
    // Dressing aggregated reporting as a government source is the one thing
    // this surface must never do.
    expect(parseReliefWeb(report('Anything')).brief?.[0]?.epistemicStatus).toBe('press-reported');
  });

  it('categorises into the allow-list', () => {
    expect(parseReliefWeb(report('Mass protest in the capital')).brief?.[0]?.category).toBe('unrest');
    expect(parseReliefWeb(report('Airstrike reported on port')).brief?.[0]?.category).toBe('conflict');
    expect(
      parseReliefWeb(report('Situation report', { disaster_type: [{ name: 'Flood' }] })).brief?.[0]
        ?.category,
    ).toBe('disaster');
  });

  it('drops an item with no named source, link or date', () => {
    const noSource = { data: [{ id: 1, fields: { title: 'x', url: 'https://a.b/c', date: { created: '2026-05-30T08:00:00+00:00' } } }] };
    expect(parseReliefWeb(noSource).brief).toHaveLength(0);
    const noDate = { data: [{ id: 1, fields: { title: 'x', url: 'https://a.b/c', source: [{ name: 'S' }] } }] };
    expect(parseReliefWeb(noDate).brief).toHaveLength(0);
  });

  it('survives junk', () => {
    for (const junk of [null, {}, { data: 'nope' }]) {
      expect(parseReliefWeb(junk).brief).toEqual([]);
    }
  });
});

describe('GDELT', () => {
  const article = (over: Record<string, unknown> = {}) => ({
    url: 'https://www.reuters.com/world/example-report',
    title: 'Thousands march in the capital over fuel prices',
    seendate: '20260601T090000Z',
    domain: 'reuters.com',
    language: 'English',
    sourcecountry: 'Chile',
    ...over,
  });

  const feed = (...articles: unknown[]) => ({ articles });

  it('republishes an allow-listed publisher by name, not by domain', () => {
    const { brief } = parseGdelt(feed(article()), 'unrest');
    expect(brief).toHaveLength(1);
    expect(brief?.[0]?.source).toBe('Reuters');
    expect(brief?.[0]?.headline).toBe('Thousands march in the capital over fuel prices');
    expect(brief?.[0]?.category).toBe('unrest');
    expect(brief?.[0]?.where).toBe('Chile');
    expect(briefSchema.safeParse(brief?.[0]).success).toBe(true);
  });

  it('drops a publisher that is not on the list', () => {
    // The editorial floor, and the only reason this source is admissible:
    // without it GDELT is an unfiltered news feed, which §5 forbids.
    for (const domain of ['contentfarm.example', 'news-aggregator.co', 'someblog.wordpress.com']) {
      expect(parseGdelt(feed(article({ domain })), 'unrest').brief).toHaveLength(0);
    }
  });

  it('treats a subdomain of an allow-listed publisher as that publisher', () => {
    expect(parseGdelt(feed(article({ domain: 'edition.cnn.com' })), 'unrest').brief?.[0]?.source).toBe(
      'CNN',
    );
    expect(parseGdelt(feed(article({ domain: 'www.bbc.co.uk' })), 'unrest').brief?.[0]?.source).toBe(
      'BBC News',
    );
  });

  it('is not fooled by a lookalike domain', () => {
    // reuters.com.evil.net ends with neither `reuters.com` on a label
    // boundary nor an exact match, and must not borrow Reuters' name.
    for (const domain of ['reuters.com.evil.net', 'notreuters.com', 'bbc.co.uk.phish.io']) {
      expect(parseGdelt(feed(article({ domain })), 'unrest').brief).toHaveLength(0);
    }
  });

  it('marks everything press-reported, never official', () => {
    // These are news reports about events, not primary documents. Dressing
    // them as a government source is the one thing this surface must not do.
    expect(parseGdelt(feed(article()), 'conflict').brief?.[0]?.epistemicStatus).toBe(
      'press-reported',
    );
  });

  it('reads GDELT compact timestamps, and drops a record it cannot date', () => {
    expect(parseSeenDate('20260601T090000Z')).toBe('2026-06-01T09:00:00.000Z');
    for (const bad of ['', undefined, 'not a date', '2026-06-01', '20261301T090000Z']) {
      expect(parseSeenDate(bad)).toBeUndefined();
    }
    expect(parseGdelt(feed(article({ seendate: 'nonsense' })), 'unrest').brief).toHaveLength(0);
  });

  it('refuses a plain http link', () => {
    // A link a network can rewrite is not a link the reader can check.
    expect(
      parseGdelt(feed(article({ url: 'http://www.reuters.com/world/x' })), 'unrest').brief,
    ).toHaveLength(0);
  });

  it('keeps one copy when the same story runs on several wires', () => {
    const same = feed(
      article({ domain: 'reuters.com', url: 'https://www.reuters.com/a' }),
      article({ domain: 'apnews.com', url: 'https://apnews.com/b' }),
    );
    expect(parseGdelt(same, 'unrest').brief).toHaveLength(1);
  });

  it('stays finite, however much comes back', () => {
    // §5: the feed ends. It does not scroll.
    const many = feed(
      ...Array.from({ length: 40 }, (_, i) =>
        article({ url: `https://www.reuters.com/world/item-${i}`, title: `Headline number ${i}` }),
      ),
    );
    expect(parseGdelt(many, 'conflict').brief?.length).toBeLessThanOrEqual(3);
  });

  it('never produces a signal', () => {
    // Unrest on the other side of the world does not move a household's
    // readiness state, and wiring a news feed into the band would make the
    // band meaningless (D11, D21).
    expect(parseGdelt(feed(article()), 'unrest').signal).toBeUndefined();
  });

  it('survives junk', () => {
    for (const junk of [null, undefined, {}, { articles: 'nope' }, []]) {
      expect(() => parseGdelt(junk, 'unrest')).not.toThrow();
      expect(parseGdelt(junk, 'unrest').brief).toEqual([]);
    }
  });

  it('asks GDELT for a bounded, recent, sorted article list', () => {
    const url = new URL(queryUrl('theme:PROTEST sourcelang:english'));
    expect(url.origin + url.pathname).toBe('https://api.gdeltproject.org/api/v2/doc/doc');
    expect(url.searchParams.get('mode')).toBe('artlist');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('timespan')).toBe('24h');
    expect(url.searchParams.get('sort')).toBe('datedesc');
    expect(url.searchParams.get('query')).toBe('theme:PROTEST sourcelang:english');
  });
});

describe('GDACS', () => {
  const event = (over: Record<string, unknown> = {}) => ({
    properties: {
      eventid: 1234567,
      eventtype: 'TC',
      name: 'Tropical Cyclone EXAMPLE-26',
      alertlevel: 'Red',
      fromdate: '2026-10-29T06:00:00',
      country: 'Philippines',
      url: { report: 'https://www.gdacs.org/report.aspx?eventid=1234567' },
      ...((over['properties'] as Record<string, unknown>) ?? {}),
    },
  });

  const feed = (...features: unknown[]) => ({ type: 'FeatureCollection', features });

  it('republishes the alert with its own report page', () => {
    const { brief } = parseGdacs(feed(event()));
    expect(brief).toHaveLength(1);
    expect(brief?.[0]?.headline).toBe('Tropical Cyclone EXAMPLE-26');
    expect(brief?.[0]?.url).toContain('gdacs.org/report.aspx');
    expect(brief?.[0]?.source).toBe('Global Disaster Alert and Coordination System');
    expect(brief?.[0]?.where).toBe('Philippines');
    expect(briefSchema.safeParse(brief?.[0]).success).toBe(true);
  });

  it('is official, because GDACS issues its own assessment', () => {
    // The distinction from the news sources: an intergovernmental alerting
    // system, not an aggregator republishing someone else's reporting.
    expect(parseGdacs(feed(event())).brief?.[0]?.epistemicStatus).toBe('official');
  });

  it('drops Green alerts, which are the routine background of a planet', () => {
    // GDACS issues them constantly. A feed that reports the routine is a feed
    // people stop reading, which costs them the one item that mattered.
    for (const alertlevel of ['Green', 'green', '', null]) {
      expect(
        parseGdacs(feed(event({ properties: { alertlevel } }))).brief,
      ).toHaveLength(0);
    }
    expect(parseGdacs(feed(event({ properties: { alertlevel: 'Orange' } }))).brief).toHaveLength(1);
  });

  it('maps event types onto the allow-list and refuses to invent a home', () => {
    const categoryOf = (eventtype: string) =>
      parseGdacs(feed(event({ properties: { eventtype } }))).brief?.[0]?.category;
    expect(categoryOf('EQ')).toBe('disaster');
    expect(categoryOf('FL')).toBe('disaster');
    expect(categoryOf('TC')).toBe('weather');
    expect(categoryOf('DR')).toBe('weather');
    // An event type with no home is dropped rather than forced into one.
    expect(parseGdacs(feed(event({ properties: { eventtype: 'XX' } }))).brief).toHaveLength(0);
  });

  it('reads an unzoned GDACS date as UTC, not as the runner timezone', () => {
    // `2026-10-29T06:00:00` with no Z would be read in whatever zone the
    // machine happens to be set to, which moves a published date by a day.
    expect(parseGdacsDate('2026-10-29T06:00:00')).toBe('2026-10-29T06:00:00.000Z');
    expect(parseGdacsDate('2026-10-29T06:00:00Z')).toBe('2026-10-29T06:00:00.000Z');
    expect(parseGdacsDate('2026-10-29T06:00:00+00:00')).toBe('2026-10-29T06:00:00.000Z');
    for (const bad of ['', null, undefined, 'not a date']) {
      expect(parseGdacsDate(bad)).toBeUndefined();
    }
  });

  it('drops a record missing its link, headline or date', () => {
    expect(parseGdacs(feed(event({ properties: { url: null } }))).brief).toHaveLength(0);
    expect(
      parseGdacs(feed(event({ properties: { url: { report: 'http://www.gdacs.org/x' } } }))).brief,
    ).toHaveLength(0);
    expect(
      parseGdacs(feed(event({ properties: { name: null, eventname: null, description: null } })))
        .brief,
    ).toHaveLength(0);
    expect(parseGdacs(feed(event({ properties: { fromdate: null } }))).brief).toHaveLength(0);
  });

  it('never produces a signal', () => {
    // A red alert on another continent must not move a county's band (D11).
    expect(parseGdacs(feed(event())).signal).toBeUndefined();
  });

  it('stays finite and drops duplicate events', () => {
    const many = feed(...Array.from({ length: 30 }, () => event()));
    // Same eventid thirty times is one event.
    expect(parseGdacs(many).brief).toHaveLength(1);

    const distinct = feed(
      ...Array.from({ length: 30 }, (_, i) => event({ properties: { eventid: i } })),
    );
    expect(parseGdacs(distinct).brief?.length).toBeLessThanOrEqual(6);
  });

  it('survives junk', () => {
    for (const junk of [null, undefined, {}, { features: 'nope' }, []]) {
      expect(() => parseGdacs(junk)).not.toThrow();
      expect(parseGdacs(junk).brief).toEqual([]);
    }
  });
});

describe('ENSO', () => {
  const NOW_ENSO = new Date('2026-10-30T00:00:00.000Z');

  /** NOAA's own layout: a header, then SEAS YR TOTAL ANOM. */
  const table = (...anomalies: number[]) =>
    ['SEAS YR TOTAL ANOM', ...anomalies.map((a, i) => `NDJ ${2020 + i} 26.00 ${a.toFixed(1)}`)].join(
      '\n',
    );

  it('reads the fixed-width series and skips the header', () => {
    const readings = parseOni(table(0.1, 0.2));
    expect(readings).toHaveLength(2);
    expect(readings[0]?.anomaly).toBeCloseTo(0.1);
    expect(readings[0]?.year).toBe(2020);
  });

  it('skips rows it cannot read rather than guessing at them', () => {
    // A half-read climate record is worse than none.
    const readings = parseOni('SEAS YR TOTAL ANOM\nNDJ 2020 26.0 0.4\ngarbage\nNDJ x 26.0 0.5\n');
    expect(readings).toHaveLength(1);
  });

  it('needs five consecutive seasons before it calls an event', () => {
    // NOAA's published rule, applied rather than invented. Four seasons past
    // the threshold is not an El Nino, and saying it was would be forecasting.
    expect(ensoState(parseOni(table(0.6, 0.7, 0.8, 0.9)))?.phase).toBe('neutral');
    expect(ensoState(parseOni(table(0.6, 0.7, 0.8, 0.9, 1.0)))?.phase).toBe('el-nino');
  });

  it('recognises La Nina in the other direction', () => {
    const state = ensoState(parseOni(table(-0.6, -0.7, -0.9, -1.2, -1.4)));
    expect(state?.phase).toBe('la-nina');
    expect(state?.peak).toBeCloseTo(-1.4);
  });

  it('breaks the run when the index comes back inside the threshold', () => {
    // 0.4 interrupts, so only the three after it count.
    expect(ensoState(parseOni(table(0.9, 0.9, 0.4, 0.9, 0.9, 0.9)))?.run).toBe(3);
  });

  it('is neutral when the latest season is inside the threshold', () => {
    const state = ensoState(parseOni(table(1.5, 1.6, 1.7, 1.8, 1.9, 0.2)));
    expect(state?.phase).toBe('neutral');
    expect(state?.run).toBe(0);
  });

  it('publishes a posture note under the pack own id, so it corrects in place', () => {
    // worldContext merges by id. A different id would show two notes about
    // the same thing, which is how a correction becomes a contradiction.
    const { posture } = parseEnso(table(1.6, 1.7, 1.8, 1.9, 2.1), NOW_ENSO);
    expect(posture).toHaveLength(1);
    expect(posture?.[0]?.id).toBe('enso-el-nino');
    expect(posture?.[0]?.title).toMatch(/very strong El Nino/);
    expect(posture?.[0]?.epistemicStatus).toBe('official');
    expect(posture?.[0]?.horizonSignalDays).toBe(120);
  });

  it('meets the pack posture schema, including the rule against predicting', () => {
    // Published through the same client code that reads the pack's own notes,
    // so it has to clear the same bar — `will`, `imminent` and the rest.
    for (const series of [
      table(1.6, 1.7, 1.8, 1.9, 2.1),
      table(-0.6, -0.8, -0.9, -1.1, -1.3),
      table(0.1, 0.2, 0.1),
    ]) {
      const note = parseEnso(series, NOW_ENSO).posture?.[0];
      expect(postureSchema.safeParse(note).success).toBe(true);
    }
  });

  it('produces no signal and no brief items', () => {
    const result = parseEnso(table(1.6, 1.7, 1.8, 1.9, 2.1), NOW_ENSO);
    expect(result.signal).toBeUndefined();
    expect(result.brief).toBeUndefined();
  });

  it('says nothing at all when the file is empty or unreadable', () => {
    // Rather than publishing a claim about the climate derived from nothing,
    // which would overwrite the pack's own note with an invention.
    for (const junk of ['', 'SEAS YR TOTAL ANOM', 'total nonsense']) {
      expect(parseEnso(junk, NOW_ENSO).posture).toBeUndefined();
    }
  });
});
