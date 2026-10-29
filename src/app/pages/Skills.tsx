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

  const index = useMemo(() => {
    if (!pack?.searchIndex) return undefined;
    return MiniSearch.loadJS(pack.searchIndex as never, {
      fields: ['title', 'summary', 'category', 'stepText', 'doesNotDoText'],
      storeFields: ['title', 'category', 'riskTier', 'summary', 'timeRequiredMin'],
      idField: 'id',
    });
  }, [pack]);

  const results = useMemo(() => {
    if (!pack) return [];
    const trimmed = query.trim();
    if (!trimmed || !index) return pack.skills;

    const ids = new Set(
      index.search(trimmed, { prefix: true, fuzzy: 0.2 }).map((r) => String(r.id)),
    );
    return pack.skills.filter((s) => ids.has(s.id));
  }, [pack, index, query]);

  if (status === 'loading') return <p className="lede">Opening the library…</p>;

  return (
    <>
      <p className="kicker">Field library · {pack?.skills.length ?? 0} entries</p>
      <h1>{t('nav.skills')}</h1>
      <p className="lede">
        Everything here is on your device already. It works with the radio off.
      </p>

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
        {results.length} of {pack?.skills.length ?? 0} skills
      </p>

      {results.length === 0 ? (
        <div className="empty">
          <strong>Nothing matched</strong>
          The library is deliberately small and deep rather than large and thin, so
          try a broader word.
        </div>
      ) : (
        results.map((skill, i) => <SkillCard key={skill.id} skill={skill} n={i + 1} />)
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
