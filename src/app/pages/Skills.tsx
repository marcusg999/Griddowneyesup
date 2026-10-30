import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import MiniSearch from 'minisearch';
import { store } from '@/db';
import { useContent } from '@/state/content';
import { t } from '@/i18n';
import type { Skill } from '@/content/types';

/**
 * The skills library. Search runs entirely against the prebuilt index that
 * shipped in the content pack — no network, no server-side search, no
 * degradation offline (§2).
 */
export function Skills() {
  const { pack, status } = useContent();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);

  /**
   * Search only helps someone who already knows the word. Fifty entries across
   * eight categories is small enough to browse and too many to scroll blind,
   * so the categories are the way in and the search box is the shortcut.
   */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const skill of pack?.skills ?? []) {
      counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pack]);

  const index = useMemo(() => {
    if (!pack?.searchIndex) return undefined;
    return MiniSearch.loadJS(pack.searchIndex as never, {
      fields: ['title', 'summary', 'category', 'stepText', 'doesNotDoText'],
      storeFields: ['title', 'category', 'riskTier', 'summary', 'timeRequiredMin'],
      idField: 'id',
      // A title match is a much stronger signal than a mention buried in step
      // seven, and the library is small enough that weighting matters.
      searchOptions: { boost: { title: 4, summary: 2 } },
    });
  }, [pack]);

  const results = useMemo(() => {
    if (!pack) return [];
    const trimmed = query.trim();
    if (!trimmed || !index) return pack.skills;

    /*
     * Require every term first, then fall back to any-term.
     *
     * Fuzzy OR matching alone put "improvised sand and charcoal column" at the
     * top of a search for "carbon monoxide", because "charcoal" is a near
     * match for "carbon" and nothing had to match "monoxide" at all. Requiring
     * all terms fixes that, and the fallback keeps a loose query useful.
     */
    const strict = index.search(trimmed, {
      prefix: true,
      fuzzy: 0.15,
      combineWith: 'AND',
      boost: { title: 4, summary: 2 },
    });
    const hits = strict.length > 0
      ? strict
      : index.search(trimmed, { prefix: true, fuzzy: 0.2, boost: { title: 4, summary: 2 } });

    // Preserve relevance order rather than falling back to library order.
    const rank = new Map(hits.map((r, i) => [String(r.id), i]));
    return pack.skills
      .filter((s) => rank.has(s.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }, [pack, index, query]);

  // The category narrows whatever search produced, rather than replacing it,
  // so the two compose: "filtration, in water" is a reasonable thing to ask.
  const shown = useMemo(
    () => (category ? results.filter((skill) => skill.category === category) : results),
    [results, category],
  );

  if (status === 'loading') return <p className="lede">Opening the library…</p>;

  return (
    <>
      <p className="kicker">Field library · {pack?.skills.length ?? 0} entries</p>
      <h1>{t('nav.skills')}</h1>
      <p className="lede">
        Everything here is on your device already. It works with the radio off.
      </p>

      <nav className="browse" aria-label="Browse by category">
        <button
          type="button"
          className="browse__chip"
          aria-pressed={category === undefined}
          onClick={() => setCategory(undefined)}
        >
          Everything <span className="browse__n tnum">{pack?.skills.length ?? 0}</span>
        </button>
        {categories.map(([name, count]) => (
          <button
            key={name}
            type="button"
            className="browse__chip"
            aria-pressed={category === name}
            // Selecting the category you are already in clears it, so the
            // filter never becomes a trap you have to hunt for the exit of.
            onClick={() => setCategory((current) => (current === name ? undefined : name))}
          >
            {name} <span className="browse__n tnum">{count}</span>
          </button>
        ))}
      </nav>

      <label htmlFor="skill-search" className="meta">
        Search the library
      </label>
      <input
        id="skill-search"
        className="search"
        type="search"
        value={query}
        placeholder="water, sanitation, heat…"
        onChange={(event) => setQuery(event.target.value)}
      />

      <p className="meta" style={{ margin: '12px 0' }} role="status">
        {shown.length} of {pack?.skills.length ?? 0} skills
        {category ? ` · ${category}` : ''}
      </p>

      {shown.length === 0 ? (
        <div className="empty">
          <strong>Nothing matched</strong>
          {category
            ? 'Nothing in this category matches that search. Clear one or the other.'
            : 'The library is deliberately small and deep rather than large and thin, so try a broader word.'}
        </div>
      ) : (
        shown.map((skill, i) => <SkillCard key={skill.id} skill={skill} n={i + 1} />)
      )}
    </>
  );
}

function SkillCard({ skill, n }: { skill: Skill; n: number }) {
  return (
    <Link href={`/skills/${skill.id}`} className="card card--link skill-card reveal">
      <span className="margin-note" aria-hidden="true">
        {String(n).padStart(2, '0')}
      </span>

      <div className="skill-card__row">
        <span className="pill">{skill.category}</span>
        {skill.riskTier !== 'low' && (
          <span className="pill" data-risk={skill.riskTier}>
            {skill.riskTier} risk
          </span>
        )}
        <span className="meta" style={{ marginLeft: 'auto' }}>
          {t('skill.timeRequired', { minutes: skill.timeRequiredMin })}
        </span>
      </div>

      {/* The element the view transition morphs into the detail heading. */}
      <h3 className="skill-card__title" data-vt-hero>
        {skill.title}
      </h3>

      <p className="meta" style={{ margin: 0 }}>
        {skill.summary}
      </p>

      {/* The limit is visible before you even open the page. */}
      {skill.stampLine && <p className="skill-card__limit">{skill.stampLine}</p>}
    </Link>
  );
}

/** Marks a skill read once it has actually been opened. */
export function useMarkRead(skillId: string | undefined) {
  useEffect(() => {
    if (!skillId) return;
    void store.skillProgress.markRead(skillId);
  }, [skillId]);
}
