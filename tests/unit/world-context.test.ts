import { describe, expect, it } from 'vitest';
import { worldContext } from '@/features/threat/worldContext';
import type { Indicator, PostureNote } from '@/content/types';
import type { ThreatSnapshot } from '@/features/threat/types';

const posture = (id: string, title: string): PostureNote => ({
  id,
  title,
  published: '2026-01-01',
  lastReviewed: '2026-01-01',
  epistemicStatus: 'official',
  whatItIs: 'Something was announced.',
  whatItMeansForYou: 'Nothing to do today.',
  citations: [],
});

const indicator = (id: string, name: string): Indicator => ({
  id,
  name,
  unit: 'USD/gal',
  current: 4.1,
  asOf: '2026-06-01',
  baseline: { label: 'last year', value: 3.4 },
  epistemicStatus: 'official',
  whatItIs: 'A reading.',
  transmission: [],
  whatItMeansForYou: 'Costs more.',
  wouldChangeThis: 'It comes back down.',
  lastReviewed: '2026-06-01',
  citations: [],
});

const pack = {
  posture: [posture('fortress', 'Pack version'), posture('other', 'Untouched')],
  indicators: [indicator('diesel', 'Pack diesel')],
};

const snapshot = (over: Partial<ThreatSnapshot> = {}): ThreatSnapshot =>
  ({
    version: 1,
    provenance: 'live',
    region: 'default',
    regionLabel: 'Test',
    publishedAt: '2026-06-01T00:00:00.000Z',
    signals: [],
    ...over,
  }) as ThreatSnapshot;

describe('world context', () => {
  it('falls back to the pack when there is no digest', () => {
    const world = worldContext(pack, undefined);
    expect(world.posture.map((p) => p.title)).toEqual(['Pack version', 'Untouched']);
    expect(world.indicators).toHaveLength(1);
  });

  it('lets a live digest correct a note by id, in place', () => {
    const world = worldContext(
      pack,
      snapshot({ posture: [posture('fortress', 'Fresher version')] }),
    );
    // Corrected, not appended: order is editorial and the digest does not own it.
    expect(world.posture.map((p) => p.title)).toEqual(['Fresher version', 'Untouched']);
  });

  it('appends notes the pack has never seen', () => {
    const world = worldContext(pack, snapshot({ posture: [posture('new', 'Brand new')] }));
    expect(world.posture.map((p) => p.id)).toEqual(['fortress', 'other', 'new']);
  });

  it('corrects what it carries without dropping what it does not', () => {
    // A publisher that reached four of six sources must be able to correct the
    // two it has. Replacing the list wholesale would silently delete the rest.
    const world = worldContext(pack, snapshot({ indicators: [indicator('diesel', 'Fresh')] }));
    expect(world.posture).toHaveLength(2);
    expect(world.indicators.map((i) => i.name)).toEqual(['Fresh']);
  });

  it('ignores an empty list rather than treating it as a deletion', () => {
    const world = worldContext(pack, snapshot({ posture: [] }));
    expect(world.posture).toHaveLength(2);
  });

  describe('a sample digest', () => {
    it('contributes no world context, whatever it carries', () => {
      // A fabricated signal is bad enough. A fabricated posture note is a claim
      // about a government's actions wearing a status that means "traceable to
      // a published source" (D21).
      const world = worldContext(
        pack,
        snapshot({
          provenance: 'sample',
          posture: [posture('fortress', 'Invented')],
          indicators: [indicator('diesel', 'Invented')],
        }),
      );
      expect(world.posture.map((p) => p.title)).toEqual(['Pack version', 'Untouched']);
      expect(world.indicators.map((i) => i.name)).toEqual(['Pack diesel']);
    });
  });

  describe('the Worth knowing feed', () => {
    const item = (id: string, published: string) =>
      ({
        id,
        category: 'conflict' as const,
        headline: `Headline ${id}`,
        whatItMeansForYou: 'Consequence.',
        url: `https://example.gov/${id}`,
        source: 'Source',
        published,
        epistemicStatus: 'official' as const,
      });

    it('orders newest first, because the reader decides what to read', () => {
      const world = worldContext(
        pack,
        snapshot({
          brief: [
            item('old', '2026-01-01T00:00:00.000Z'),
            item('new', '2026-06-01T00:00:00.000Z'),
            item('middle', '2026-03-01T00:00:00.000Z'),
          ],
        }),
      );
      expect(world.brief.map((b) => b.id)).toEqual(['new', 'middle', 'old']);
    });

    it('sorts an unparseable date last rather than scrambling the feed', () => {
      const world = worldContext(
        pack,
        snapshot({ brief: [item('broken', 'not a date'), item('good', '2026-06-01T00:00:00.000Z')] }),
      );
      expect(world.brief.map((b) => b.id)).toEqual(['good', 'broken']);
    });

    it('is empty from the pack alone — events belong to the publisher', () => {
      // A dated event baked into a build artifact goes stale on a phone that
      // sits for months, and a stale claim about a war is worse than none.
      expect(worldContext(pack, undefined).brief).toEqual([]);
    });

    it('is ignored entirely from a sample digest', () => {
      const world = worldContext(
        pack,
        snapshot({ provenance: 'sample', brief: [item('invented', '2026-06-01T00:00:00.000Z')] }),
      );
      expect(world.brief).toEqual([]);
    });
  });

  it('survives a pack that has not loaded yet', () => {
    expect(worldContext(undefined, snapshot())).toEqual({
      posture: [],
      indicators: [],
      brief: [],
    });
  });
});
