import type { BriefCategory, BriefItem } from './types';

/**
 * Worth knowing, grouped by subject.
 *
 * The feed arrived as one newest-first list, which is the right shape for a
 * handful of items and the wrong one for twenty: an earthquake, three
 * droughts and a protest interleaved by timestamp is a list you scan rather
 * than read. Grouped by subject, a reader who only cares about weather can
 * find all of it in one place and fold the rest away.
 *
 * Ordering is fixed rather than driven by what arrived. A section list that
 * reorders itself as the world changes is one the reader has to re-learn
 * every morning, and the point of a daily surface is that it is in the same
 * shape every day.
 */

/**
 * Editorial order, nearest-to-a-household first.
 *
 * Disasters and weather are physical events that reach a house directly.
 * Conflict and unrest reach it through prices and supply, on a longer lag.
 * Infrastructure sits last because it is the rarest, not the least important
 * — when it has something, that something is usually already visible in the
 * categories above it.
 */
export const CATEGORY_ORDER: readonly BriefCategory[] = [
  'disaster',
  'weather',
  'unrest',
  'conflict',
  'infrastructure',
];

/**
 * What each subject is called on screen.
 *
 * `unrest` is labelled for both halves of what it carries. The collectors map
 * protests, riots and police-brutality coverage into the single `unrest`
 * category, so a heading that said only "Unrest" would under-describe it and
 * one that said only "Protest" would over-claim. Naming both is the honest
 * summary of what is actually in there.
 */
export const CATEGORY_LABEL: Readonly<Record<BriefCategory, string>> = {
  disaster: 'Disasters',
  weather: 'Weather',
  unrest: 'Protest and civil unrest',
  conflict: 'Conflict',
  infrastructure: 'Infrastructure',
};

export interface BriefGroup {
  readonly category: BriefCategory;
  readonly label: string;
  /** Newest first, as the feed already ordered them. */
  readonly items: readonly BriefItem[];
}

/**
 * Groups into the fixed order above, dropping subjects with nothing in them.
 *
 * An empty section is worse than a missing one: it reads as a category the
 * app is failing to fill rather than a quiet day, and this surface has a
 * separate, explicit way of saying a source could not be reached.
 */
export function groupBrief(items: readonly BriefItem[]): readonly BriefGroup[] {
  const byCategory = new Map<BriefCategory, BriefItem[]>();

  for (const item of items) {
    // A category the order does not know about is still shown rather than
    // silently dropped — see the loop below. Dropping a real event because a
    // new category was added upstream is the worst possible failure here.
    const bucket = byCategory.get(item.category);
    if (bucket) bucket.push(item);
    else byCategory.set(item.category, [item]);
  }

  const known = CATEGORY_ORDER.filter((category) => byCategory.has(category));
  const unknown = [...byCategory.keys()].filter(
    (category) => !CATEGORY_ORDER.includes(category),
  );

  return [...known, ...unknown].map((category) => ({
    category,
    label: CATEGORY_LABEL[category] ?? category,
    items: byCategory.get(category) ?? [],
  }));
}
