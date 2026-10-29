import { Link } from 'wouter';
import { t } from '@/i18n';
import { useReadiness } from '@/state/readiness';
import { useSupply } from '@/features/supply/useSupply';
import { CoverageStave } from '@/ui/CoverageStave';
import { Posture } from '@/ui/Posture';
import { useContent } from '@/state/content';
import { tierFor, wholeDays, limitingDays } from '@/features/supply/coverage';

const RESOURCE_LABEL: Record<string, string> = {
  'water-litres': 'water',
  'calories-kcal': 'calories',
  'heat-hours': 'heat',
  'power-wh': 'power',
  'sanitation-uses': 'sanitation',
};

const RESOURCE_NOTE: Record<string, string> = {
  'water-litres': 'one gallon per person per day — drinking and minimal hygiene',
  'calories-kcal': 'ready to eat, no cooking required',
  'heat-hours': 'stove and fuel on hand',
  'power-wh': 'phones, one lamp, the radio',
  'sanitation-uses': 'bucket uses with cover material',
};

const TIER_LABEL: Record<string, string> = {
  unprepared: t('tier.unprepared'),
  '72hour': t('tier.72hour'),
  twoWeek: t('tier.twoWeek'),
  oneMonth: t('tier.oneMonth'),
  season: t('tier.season'),
};

export function Today() {
  const { state, suppressGamification } = useReadiness();
  const { coverage, loading, profile } = useSupply();
  const { pack } = useContent();

  // GREY SKY: four things only. No feed, no coverage, no tiers, no badges.
  if (state === 'grey-sky') return <GreySky />;

  const days = limitingDays(coverage);
  const measured = coverage.filter((c) => c.dailyNeed > 0);
  const empty = measured.every((c) => c.stock === 0);

  return (
    <>
      <p className="kicker">
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <h1>{state === 'watch' ? t('state.watch') : t('state.blueSky')}</h1>
      <p className="lede">
        {state === 'watch' ? t('state.watch.summary') : t('state.blueSky.summary')}
      </p>

      <h2>
        <span className="margin-note" aria-hidden="true">
          soundings
        </span>
        {t('coverage.heading')}
      </h2>

      {loading ? (
        <p className="meta">Reading your inventory…</p>
      ) : empty ? (
        <div className="empty">
          <strong>Nothing logged yet</strong>
          {t('coverage.empty')}
        </div>
      ) : (
        <>
          <div className="coverage">
            {measured.map((row) => {
              const d = wholeDays(row.days);
              const thin = d < 3;
              return (
                <div className="coverage__row reveal" key={row.resource}>
                  <span className="coverage__days tnum" data-thin={thin}>
                    {d}
                  </span>
                  <span className="coverage__label">
                    {t('coverage.days', { n: d })} of {RESOURCE_LABEL[row.resource]}
                    <small>{RESOURCE_NOTE[row.resource]}</small>
                  </span>
                  <span className="coverage__raw">
                    {row.stock.toFixed(0)} on hand · {row.dailyNeed.toFixed(1)} used per day
                  </span>
                  <CoverageStave days={d} target={profile.targetHorizonDays} thin={thin} />
                  <div className="stave-legend" aria-hidden="true">
                    <span>0</span>
                    <span>72h</span>
                    <span>2wk</span>
                    <span>30d</span>
                  </div>
                </div>
              );
            })}
          </div>

          {!suppressGamification && (
            <p className="pullquote">
              {TIER_LABEL[tierFor(days)]}. The binding constraint is whatever runs out
              first, which is why this is the smallest number and not the average.
            </p>
          )}
        </>
      )}

      <h2>
        <span className="margin-note" aria-hidden="true">
          six signals
        </span>
        Near you
      </h2>

      {/* The designed "nothing notable" state. Most days should show this. */}
      <div className="empty reveal">
        <strong>{t('threat.nothingNotable')}</strong>
        {t('threat.nothingNotable.body')}
      </div>
      <p className="meta">{t('threat.digestEnds')}</p>

      {/* Baseline context, kept well apart from the live digest above. It is
          measured in months and never moves the readiness state. */}
      {(pack?.posture.length ?? 0) > 0 && (
        <>
          <h2>
            <span className="margin-note" aria-hidden="true">
              standing
            </span>
            Worth knowing
          </h2>
          <p className="meta" style={{ marginTop: -6, marginBottom: 14 }}>
            Background, not an alert. Nothing here needs doing today.
          </p>
          {pack?.posture.map((note) => (
            <Posture key={note.id} note={note} targetDays={profile.targetHorizonDays} />
          ))}
        </>
      )}

      <h2>
        <span className="margin-note" aria-hidden="true">
          next
        </span>
        Worth doing
      </h2>

      <Link href="/skills/water-hollow-fibre-filter" className="card card--link reveal">
        <strong>Know what your filter does not do</strong>
        <p className="meta" style={{ margin: '5px 0 0' }}>
          Most filters do not remove viruses, and a filter that has frozen while wet
          looks exactly like a working one.
        </p>
      </Link>

      <Link href="/supplies" className="card card--link reveal">
        <strong>Start the ladder at Everyday Carry</strong>
        <p className="meta" style={{ margin: '5px 0 0' }}>
          It costs almost nothing and you probably already have most of it.
        </p>
      </Link>

      {/* The rail: instruments and raw figures, beside the prose rather than
          interrupting it. */}
      <aside className="rail">
        <h3>Standing</h3>
        <dl>
          <dt>Household</dt>
          <dd>
            {profile.members.length} {profile.members.length === 1 ? 'person' : 'people'}
            {profile.pets > 0 ? `, ${profile.pets} pets` : ''}
          </dd>
          <dt>Target horizon</dt>
          <dd>{profile.targetHorizonDays} days</dd>
          <dt>Binding constraint</dt>
          <dd>{wholeDays(days)} days</dd>
          <dt>Signals checked</dt>
          <dd>6 · none notable</dd>
          <dt>Last synced</dt>
          <dd>never — all local</dd>
        </dl>
      </aside>
    </>
  );
}

/**
 * GREY SKY. Four things. White on black, 88px targets, no motion, no colour.
 * Assume 12% battery, one bar, and hands that are not steady.
 */
function GreySky() {
  const links = [
    { href: '/plan', label: t('greySky.myPlan') },
    { href: '/skills/water-boil', label: t('greySky.water') },
    { href: '/skills/sanitation-twin-bucket', label: t('greySky.shelterHeat') },
    { href: '/plan', label: t('greySky.contact') },
  ];

  return (
    <>
      <h1>{t('state.greySky')}</h1>
      <nav aria-label="Essentials" className="grey-nav">
        {links.map((link) => (
          <Link key={link.label} href={link.href} className="grey-link">
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
