import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER, groupBrief } from '@/features/threat/groupBrief';
import type { BriefCategory, BriefItem } from '@/features/threat/types';

const item = (id: string, category: BriefCategory, published = '2026-06-01T00:00:00.000Z'): BriefItem => ({
  id,
  category,
  headline: `Headline ${id}`,
  whatItMeansForYou: 'Consequence.',
  url: `https://example.gov/${id}`,
  source: 'Source',
  published,
  epistemicStatus: 'official',
});

describe('grouping Worth knowing by subject', () => {
  it('uses a fixed order rather than the order things arrived in', () => {
    // A section list that reorders itself as the world changes is one the
    // reader has to re-learn every morning.
    const groups = groupBrief([
      item('a', 'conflict'),
      item('b', 'disaster'),
      item('c', 'infrastructure'),
      item('d', 'weather'),
      item('e', 'unrest'),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      'disaster',
      'weather',
      'unrest',
      'conflict',
      'infrastructure',
    ]);
  });

  it('drops a subject with nothing in it', () => {
    // An empty section reads as a category the app is failing to fill rather
    // than a quiet day, and there is a separate, explicit line for a source
    // that could not be reached.
    const groups = groupBrief([item('a', 'disaster'), item('b', 'disaster')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('keeps the feed order inside a group', () => {
    // worldContext already sorted newest-first; grouping must not reshuffle.
    const groups = groupBrief([
      item('new', 'weather', '2026-06-03T00:00:00.000Z'),
      item('mid', 'weather', '2026-06-02T00:00:00.000Z'),
      item('old', 'weather', '2026-06-01T00:00:00.000Z'),
    ]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['new', 'mid', 'old']);
  });

  it('names unrest for both halves of what it carries', () => {
    // The collectors map protests, riots and police-brutality coverage into
    // one category. "Unrest" alone under-describes it; "Protest" alone
    // over-claims.
    const [group] = groupBrief([item('a', 'unrest')]);
    expect(group?.label).toBe('Protest and civil unrest');
  });

  it('shows a category the order has never heard of rather than dropping it', () => {
    // Dropping a real event because a new category was added upstream is the
    // worst failure available here, so unknown subjects land at the end.
    const groups = groupBrief([
      item('known', 'disaster'),
      { ...item('new', 'disaster'), category: 'volcano' as BriefCategory },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['disaster', 'volcano']);
    // With no label of its own it falls back to the raw name, which is ugly
    // and visible — far better than silence.
    expect(groups[1]?.label).toBe('volcano');
  });

  it('returns nothing for an empty feed, so the section can render nothing', () => {
    expect(groupBrief([])).toEqual([]);
  });

  it('has a label for every category in the order', () => {
    for (const category of CATEGORY_ORDER) {
      const [group] = groupBrief([item('x', category)]);
      expect(group?.label).toBeTruthy();
      expect(group?.label).not.toBe(category);
    }
  });
});
