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
          Nothing matched that. The library is deliberately small and deep rather
          than large and thin, so try a broader word.
        </div>
      ) : (
        results.map((skill) => <SkillCard key={skill.id} skill={skill} />)
      )}
    </>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <Link href={`/skills/${skill.id}`} className="card card--link">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
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
      <h3 style={{ margin: '0 0 4px' }}>{skill.title}</h3>
      <p className="meta" style={{ margin: 0 }}>
        {skill.summary}
      </p>
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
