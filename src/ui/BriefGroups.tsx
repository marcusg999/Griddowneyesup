import type { BriefItem } from '@/features/threat/types';
import { groupBrief } from '@/features/threat/groupBrief';
import { Brief } from './Brief';

/**
 * Worth knowing, in collapsible sections by subject.
 *
 * Open by default, every one of them. Collapsing is an affordance for a
 * reader who wants to put the weather away, not a default that hides the one
 * item that mattered behind a heading nobody expanded. §5 says this feed is
 * finite and ends; a screen of folded headers would make it look endless
 * while showing nothing.
 *
 * Native `details`, so it works with no JavaScript, keeps its keyboard and
 * screen-reader semantics for free, and survives the service worker serving
 * a stale shell.
 */
export function BriefGroups({
  items,
  now,
}: {
  readonly items: readonly BriefItem[];
  readonly now: Date;
}) {
  const groups = groupBrief(items);
  if (groups.length === 0) return null;

  return (
    <div className="brief-groups">
      {groups.map((group) => (
        <details className="brief-group" key={group.category} open>
          <summary className="brief-group__summary">
            <span className="brief-group__label">{group.label}</span>
            {/* The count is on the summary so a folded section still says how
                much is inside it. A collapsed heading with no number is a
                question rather than a summary. */}
            <span className="brief-group__count tnum">{group.items.length}</span>
          </summary>

          {group.items.map((item) => (
            <Brief key={item.id} item={item} now={now} />
          ))}
        </details>
      ))}
    </div>
  );
}
