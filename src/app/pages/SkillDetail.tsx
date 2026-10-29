import { Link, useRoute } from 'wouter';
import { useContent } from '@/state/content';
import { useMarkRead } from './Skills';
import { Stamp } from '@/ui/Stamp';
import { HERO_NAME } from '@/ui/viewTransition';
import { t } from '@/i18n';

/**
 * A single skill.
 *
 * The limits come BEFORE the steps, and they come as a pinned stamp sequence
 * you have to scroll through. CONTENT_POLICY §3.2 requires the limits to be
 * impossible to miss, and putting them after the steps means putting them
 * after the point at which someone has started doing it.
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

  const itemName = (id: string) => pack?.items.find((i) => i.id === id)?.name ?? id;

  return (
    <article>
      <p className="meta">
        <Link href="/skills">← {t('nav.skills')}</Link>
      </p>

      <p className="kicker">
        {skill.category} · {t('skill.timeRequired', { minutes: skill.timeRequiredMin })} ·{' '}
        {skill.difficulty}
      </p>

      <h1 style={{ viewTransitionName: HERO_NAME }}>{skill.title}</h1>

      <p className="lede">{skill.summary}</p>

      {skill.riskTier === 'high' && <p className="caution">{t('skill.risk.high')}</p>}

      {/* THE STAMP. See docs/DESIGN_CONTRACT.md. */}
      <section className="limits" aria-labelledby="does-not-do-heading">
        <div className="limits__pin">
          {skill.stampLine && (
            <div className="limits__stamp">
              <Stamp line={skill.stampLine} />
            </div>
          )}
          <h2 id="does-not-do-heading" className="limits__head">
            {t('skill.doesNotDo')}
          </h2>
          <ul className="limits__list">
            {skill.doesNotDo.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <p className="limits__onward" aria-hidden="true">
            ↓ the method follows
          </p>
        </div>
      </section>

      {skill.materials.length > 0 && (
        <>
          <h2 className="reveal">{t('skill.materials')}</h2>
          <ul className="reveal">
            {skill.materials.map((id) => (
              <li key={id}>{itemName(id)}</li>
            ))}
          </ul>
        </>
      )}

      <h2 className="reveal">Steps</h2>
      <ol className="steps">
        {skill.steps.map((step) => (
          <li key={step.n} className="reveal">
            <div>{step.text}</div>
            {step.caution && <p className="caution">{step.caution}</p>}
          </li>
        ))}
      </ol>

      {skill.failureModes.length > 0 && (
        <>
          <h2 className="reveal">{t('skill.failureModes')}</h2>
          {skill.failureModes.map((mode) => (
            <div className="card reveal" key={mode.symptom}>
              <strong>{mode.symptom}</strong>
              <p className="meta" style={{ margin: '4px 0' }}>
                Why: {mode.cause}
              </p>
              <p style={{ margin: 0 }}>Fix: {mode.remedy}</p>
            </div>
          ))}
        </>
      )}

      <h2 className="reveal">{t('skill.sources')}</h2>
      <ul className="meta reveal">
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

      <p className="print-row">
        <Link href={`/print/skill/${skill.id}`} className="btn btn--ghost">
          Print this page
        </Link>
      </p>

      <aside className="rail">
        <h3>Entry</h3>
        <dl>
          <dt>Category</dt>
          <dd>{skill.category}</dd>
          <dt>Risk tier</dt>
          <dd>{skill.riskTier}</dd>
          <dt>Difficulty</dt>
          <dd>{skill.difficulty}</dd>
          <dt>Time</dt>
          <dd>{skill.timeRequiredMin} min</dd>
          <dt>Steps</dt>
          <dd>{skill.steps.length}</dd>
          <dt>Stated limits</dt>
          <dd>{skill.doesNotDo.length}</dd>
          <dt>Sources</dt>
          <dd>{skill.citations.length}</dd>
          <dt>Reviewed</dt>
          <dd>{skill.lastReviewed}</dd>
        </dl>
      </aside>
    </article>
  );
}
