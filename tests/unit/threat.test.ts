import { describe, expect, it } from 'vitest';
import { isStale, threatIndex } from '@/features/threat/band';
import type { SignalLevel, SignalSourceId, ThreatSignal, ThreatSnapshot } from '@/features/threat/types';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const hoursAgo = (h: number): string =>
  new Date(NOW.getTime() - h * 3_600_000).toISOString();

const signal = (
  source: SignalSourceId,
  level: SignalLevel,
  ageHours = 1,
  headline = 'Something',
): ThreatSignal => ({
  source,
  sourceName: source.toUpperCase(),
  level,
  headline,
  meansForYou: 'Consequence.',
  url: `https://example.gov/${source}`,
  observedAt: hoursAgo(ageHours),
});

const snapshot = (
  signals: ThreatSignal[],
  provenance: ThreatSnapshot['provenance'] = 'live',
): ThreatSnapshot => ({
  version: 1,
  provenance,
  region: '06075',
  regionLabel: 'Test County',
  publishedAt: hoursAgo(1),
  signals,
});

describe('the Threat Index band', () => {
  it('holds at quiet when every reporting source says nothing is active', () => {
    const index = threatIndex(snapshot([signal('nws', 'quiet'), signal('usgs', 'quiet')]), NOW);
    expect(index.band).toBe('quiet');
    expect(index.notable).toHaveLength(0);
    expect(index.suggests).toBe('blue-sky');
  });

  it('is elevated when something is forming, which is what WATCH means', () => {
    const index = threatIndex(snapshot([signal('nws', 'elevated'), signal('usgs', 'quiet')]), NOW);
    expect(index.band).toBe('elevated');
    expect(index.suggests).toBe('watch');
  });

  it('is active when any current source is active', () => {
    const index = threatIndex(snapshot([signal('nws', 'elevated'), signal('swpc', 'active')]), NOW);
    expect(index.band).toBe('active');
    expect(index.suggests).toBe('watch');
  });

  it('never reports a composite number — D11 rejected it', () => {
    const index = threatIndex(snapshot([signal('nws', 'active')]), NOW);
    // The shape itself is the guarantee: a band, its reasons, and counts of
    // sources. Nothing here averages the signals into a score.
    expect(Object.keys(index)).not.toContain('score');
    expect(typeof index.band).toBe('string');
  });

  describe('staleness', () => {
    it('applies a per-source freshness window, not one global figure', () => {
      // An eight-hour-old NWS warning has almost certainly expired; an
      // eight-hour-old federal declaration has not.
      expect(isStale(signal('nws', 'active', 8), NOW)).toBe(true);
      expect(isStale(signal('openfema', 'active', 8), NOW)).toBe(false);
    });

    it('does not let a stale signal raise the band', () => {
      // Manufacturing alarm from a record we cannot vouch for is exactly the
      // failure §5 is written against.
      const index = threatIndex(snapshot([signal('nws', 'active', 9)]), NOW);
      expect(index.band).toBe('quiet');
      expect(index.staleFor).toEqual(['nws']);
    });

    it('still gives a stale signal its card, so nothing is hidden', () => {
      const index = threatIndex(snapshot([signal('nws', 'active', 9)]), NOW);
      expect(index.notable).toHaveLength(1);
      expect(index.notable[0]?.source).toBe('nws');
    });

    it('says in its reasons that the stale signal was not counted', () => {
      const index = threatIndex(snapshot([signal('nws', 'active', 9)]), NOW);
      expect(index.reasons.some((r) => /freshness window/.test(r.text))).toBe(true);
    });

    it('treats an unparseable timestamp as stale rather than as current', () => {
      const broken: ThreatSignal = { ...signal('nws', 'active'), observedAt: 'not a date' };
      expect(isStale(broken, NOW)).toBe(true);
      expect(threatIndex(snapshot([broken]), NOW).band).toBe('quiet');
    });
  });

  describe('the reasons, which are the point of a band over a number', () => {
    it('names the source and its own headline for each signal that raised it', () => {
      const index = threatIndex(
        snapshot([signal('nws', 'active', 1, 'Flash flood warning until 1800')]),
        NOW,
      );
      expect(index.reasons[0]?.text).toBe('NWS: Flash flood warning until 1800');
      expect(index.reasons[0]?.source).toBe('nws');
    });

    it('explains a quiet band too, rather than leaving it unjustified', () => {
      const index = threatIndex(snapshot([signal('usgs', 'quiet')]), NOW);
      expect(index.reasons.length).toBeGreaterThan(0);
      expect(index.reasons[0]?.text).toMatch(/nothing active/);
    });
  });

  describe('confidence', () => {
    it('counts the NRI baseline as reporting, since it ships with the app', () => {
      const index = threatIndex(snapshot([signal('nws', 'quiet'), signal('usgs', 'quiet')]), NOW);
      expect(index.sourceCount).toBe(6);
      expect(index.reportingCount).toBe(3);
    });

    it('does not count a stale source as reporting', () => {
      const index = threatIndex(
        snapshot([signal('nws', 'quiet', 9), signal('usgs', 'quiet', 1)]),
        NOW,
      );
      expect(index.reportingCount).toBe(2);
    });

    it('never claims more sources than D10 has', () => {
      const many = (['nws', 'usgs', 'wildfire-air', 'openfema', 'swpc'] as SignalSourceId[]).map(
        (s) => signal(s, 'quiet'),
      );
      const index = threatIndex(snapshot(many), NOW);
      expect(index.reportingCount).toBe(6);
      expect(index.reportingCount).toBeLessThanOrEqual(index.sourceCount);
    });
  });

  describe('with no snapshot at all', () => {
    it('is quiet and says so, rather than rendering an error', () => {
      const index = threatIndex(undefined, NOW);
      expect(index.band).toBe('quiet');
      expect(index.suggests).toBe('blue-sky');
      expect(index.notable).toEqual([]);
      expect(index.reportingCount).toBe(0);
      expect(index.reasons[0]?.text).toMatch(/nothing has been assessed/);
    });
  });

  it('orders cards by severity, then by how recent they are', () => {
    const index = threatIndex(
      snapshot([
        signal('usgs', 'elevated', 1, 'older elevated'),
        signal('nws', 'active', 3, 'active'),
        signal('swpc', 'elevated', 0.5, 'newer elevated'),
      ]),
      NOW,
    );
    expect(index.notable.map((s) => s.headline)).toEqual([
      'active',
      'newer elevated',
      'older elevated',
    ]);
  });

  describe('a sample digest', () => {
    it('is marked as one, so the surface can say so', () => {
      expect(threatIndex(snapshot([signal('nws', 'active')], 'sample'), NOW).isSample).toBe(true);
      expect(threatIndex(snapshot([signal('nws', 'active')]), NOW).isSample).toBe(false);
    });

    it('still derives its band, so the rules stay visible', () => {
      expect(threatIndex(snapshot([signal('nws', 'active')], 'sample'), NOW).band).toBe('active');
    });

    it('never suggests a readiness state, however active it looks', () => {
      // A false alarm the product manufactured from its own fixtures would be
      // the worst kind. Illustrative data does not get to move the user.
      const index = threatIndex(snapshot([signal('nws', 'active')], 'sample'), NOW);
      expect(index.suggests).toBe('blue-sky');
    });
  });

  it('never suggests grey-sky — that is a declaration, not an inference', () => {
    const everything = (['nws', 'usgs', 'wildfire-air', 'openfema', 'swpc'] as SignalSourceId[]).map(
      (s) => signal(s, 'active'),
    );
    const index = threatIndex(snapshot(everything), NOW);
    expect(index.band).toBe('active');
    // The strongest thing a digest may do is suggest WATCH. Stripping the
    // interface to four buttons stays the user's call (or D12's narrow gate).
    expect(index.suggests).toBe('watch');
  });
});
