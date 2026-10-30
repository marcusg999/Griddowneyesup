import type { BriefItem } from '@/features/threat/types';
import { timeAgo } from './relativeTime';

/**
 * A Worth-knowing item. §9, §4.4, §5.
 *
 * The rules this surface is built against, stated as layout:
 *
 *   The headline is the source's, in its own words. We do not rewrite it into
 *   something punchier, and we never join two of them into a third claim
 *   neither source made.
 *
 *   The link is mandatory and goes to the specific item, not a front page. An
 *   unlinked claim about the world is one the reader cannot check, which is
 *   just asking to be trusted.
 *
 *   The epistemic status is shown rather than flattened. "A government
 *   announced this" and "a news agency reports officials said this" are
 *   different kinds of claim, and rendering them identically is lying by
 *   layout.
 *
 *   No urgency styling. This surface is explicitly not an alert: it is the
 *   thing you read with coffee, and if it ever starts shouting it has become
 *   the doomscroll §5 forbids.
 */

const CATEGORY_LABEL: Record<BriefItem['category'], string> = {
  unrest: 'Unrest',
  conflict: 'Conflict',
  disaster: 'Disaster',
  weather: 'Weather',
  infrastructure: 'Infrastructure',
};

const STATUS_LABEL: Record<BriefItem['epistemicStatus'], string> = {
  official: 'Official source',
  'press-reported': 'Press reported — no primary source',
  mixed: 'Official announcement, reported detail',
};

export function Brief({ item, now }: { item: BriefItem; now: Date }) {
  return (
    <article className="brief reveal" data-category={item.category}>
      <p className="brief__meta meta">
        <span className="brief__tag">{CATEGORY_LABEL[item.category]}</span>
        {item.where ? ` · ${item.where}` : ''}
        {' · '}
        {timeAgo(item.published, now)}
      </p>

      <h3 className="brief__headline">{item.headline}</h3>

      <p className="brief__means">{item.whatItMeansForYou}</p>

      <p className="meta brief__source">
        {STATUS_LABEL[item.epistemicStatus]} ·{' '}
        <a href={item.url} target="_blank" rel="noreferrer noopener">
          {item.source}
        </a>
      </p>
    </article>
  );
}
