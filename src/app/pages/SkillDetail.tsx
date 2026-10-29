import { Link, useRoute } from 'wouter';
import { useContent } from '@/state/content';
import { useMarkRead } from './Skills';
import { t } from '@/i18n';

/**
 * A single skill.
 *
 * Note the ordering: what this does NOT do is rendered immediately after the
 * summary and BEFORE the steps. CONTENT_POLICY §3.2 requires the limits to be
 * impossible to miss, and putting them at the bottom means putting them after
 * the point at which someone has started doing it.
 */
export function SkillDetail() {
  const [, params] = useRoute('/skills/:id');
  const { pack, status } = useContent();
  const skill = pack?.skills.find((s) => s.id === params?.id);

  useMarkRead(skill?.id);

  if (status === 'loading') return <p className="lede">Opening…</p>;

  if (!skill) {
    return (
      <>
        <h1>Not in the library</h1>
        <p className="lede">
          No skill with that name. <Link href="/skills">Back to the library</Link>.
        </p>
      </>
    );
  }

  const itemName = (id: string) =>
    pack?.items.find((i) => i.id === id)?.name ?? id;

  return (
    <article>
      <p className="meta">
        <Link href="/skills">← {t('nav.skills')}</Link>
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
        <span className="pill">{skill.category}</span>
        {skill.riskTier !== 'low' && (
          <span className="pill" data-risk={skill.riskTier}>
            {skill.riskTier} risk
          </span>
        )}
        <span className="meta">{t('skill.timeRequired', { minutes: skill.timeRequiredMin })}</span>
      </div>

      <h1>{skill.title}</h1>
      <p className="lede">{skill.summary}</p>

      {skill.riskTier === 'high' && (
        <p className="caution" role="note">
          {t('skill.risk.high')}
        </p>
      )}

      <section className="does-not-do" aria-labelledby="does-not-do-heading">
        <h3 id="does-not-do-heading">{t('skill.doesNotDo')}</h3>
        <ul>
          {skill.doesNotDo.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>

      {skill.materials.length > 0 && (
        <>
          <h2>{t('skill.materials')}</h2>
          <ul>
            {skill.materials.map((id) => (
              <li key={id}>{itemName(id)}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Steps</h2>
      <ol className="steps">
        {skill.steps.map((step) => (
          <li key={step.n}>
            <div>{step.text}</div>
            {step.caution && (
              <p className="caution" role="note">
                {step.caution}
              </p>
            )}
          </li>
        ))}
      </ol>

      {skill.failureModes.length > 0 && (
        <>
          <h2>{t('skill.failureModes')}</h2>
          {skill.failureModes.map((mode) => (
            <div className="card" key={mode.symptom}>
              <strong>{mode.symptom}</strong>
              <p className="meta" style={{ margin: '4px 0' }}>
                Why: {mode.cause}
              </p>
              <p style={{ margin: 0 }}>Fix: {mode.remedy}</p>
            </div>
          ))}
        </>
      )}

      <h2>{t('skill.sources')}</h2>
      <ul className="meta">
        {skill.citations.map((citation) => (
          <li key={`${citation.source}-${citation.title}`}>
            {citation.source}, <em>{citation.title}</em> ({citation.published})
            {citation.url && (
              <>
                {' · '}
                <a href={citation.url} rel="noreferrer noopener" target="_blank">
                  source
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="meta">{t('skill.lastReviewed', { date: skill.lastReviewed })}</p>
    </article>
  );
}
