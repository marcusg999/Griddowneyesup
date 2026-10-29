import { Link } from 'wouter';
import { t } from '@/i18n';
import { useReadiness } from '@/state/readiness';
import { useSupply } from '@/features/supply/useSupply';
import { tierFor, wholeDays, limitingDays } from '@/features/supply/coverage';

const RESOURCE_LABEL: Record<string, string> = {
  'water-litres': 'water',
  'calories-kcal': 'calories',
  'heat-hours': 'heat',
  'power-wh': 'power',
  'sanitation-uses': 'sanitation',
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
  const { coverage, loading } = useSupply();

  // GREY SKY: four things only. No feed, no coverage curve, no tiers, no
  // badges. §3, and policy G08.
  if (state === 'grey-sky') return <GreySky />;

  const days = limitingDays(coverage);
  const measured = coverage.filter((c) => c.dailyNeed > 0);

  return (
    <>
      <h1>{t('nav.today')}</h1>
      <p className="lede">
        {state === 'watch' ? t('state.watch.summary') : t('state.blueSky.summary')}
      </p>

      <h2>{t('coverage.heading')}</h2>

      {loading ? (
        <p className="meta">Reading your inventory…</p>
      ) : measured.every((c) => c.stock === 0) ? (
        <div className="empty">{t('coverage.empty')}</div>
      ) : (
        <>
          <div className="coverage">
            {measured.map((row) => (
              <div className="coverage__row" key={row.resource}>
                <span className="coverage__days">{wholeDays(row.days)}</span>
                <span className="coverage__label">
                  {t('coverage.days', { n: wholeDays(row.days) })} of{' '}
                  {RESOURCE_LABEL[row.resource] ?? row.resource}
                </span>
              </div>
            ))}
          </div>

          {!suppressGamification && (
            <p className="meta">
              Readiness tier: <strong>{TIER_LABEL[tierFor(days)]}</strong>. The binding
              constraint is whatever runs out first, which is why this is the smallest
              number and not the average.
            </p>
          )}
        </>
      )}

      <h2>Near you</h2>
      {/*
        The designed "nothing notable" state (§4.1). Most days should show
        this. The index going green is a feature, not an empty screen.
      */}
      <div className="empty">
        <strong>{t('threat.nothingNotable')}</strong>
        <p style={{ margin: '8px 0 0' }}>{t('threat.nothingNotable.body')}</p>
      </div>
      <p className="meta">{t('threat.digestEnds')}</p>

      <h2>Worth doing</h2>
      <Link href="/skills/water-boil" className="card card--link">
        <strong>Learn to make water safe</strong>
        <p className="meta" style={{ margin: '4px 0 0' }}>
          Boiling, bleach, and the difference between filtering and purifying — which is
          the distinction that actually matters.
        </p>
      </Link>
      <Link href="/supplies" className="card card--link">
        <strong>Start the ladder at Everyday Carry</strong>
        <p className="meta" style={{ margin: '4px 0 0' }}>
          It costs almost nothing and you probably already have most of it.
        </p>
      </Link>
    </>
  );
}

/**
 * GREY SKY. Four things, nothing else. Large targets, maximum contrast.
 * Assume 12% battery, one bar, and hands that are not steady.
 */
function GreySky() {
  const links = [
    { href: '/plan', label: t('greySky.myPlan') },
    { href: '/skills/water-boil', label: t('greySky.water') },
    { href: '/skills?c=heat-shelter', label: t('greySky.shelterHeat') },
    { href: '/plan#contacts', label: t('greySky.contact') },
  ];

  return (
    <>
      <h1>{t('state.greySky')}</h1>
      <nav aria-label="Essentials">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="card card--link"
            style={{ fontSize: 22, fontWeight: 650, padding: 24 }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
