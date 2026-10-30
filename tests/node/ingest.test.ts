import { describe, expect, it } from 'vitest';
import { briefSchema, signalSchema } from '../../scripts/ingest/schema';
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
