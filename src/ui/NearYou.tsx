import { t } from '@/i18n';
import { isStale, type ThreatBand, type ThreatIndex } from '@/features/threat/band';
import type { ThreatSignal } from '@/features/threat/types';
import { timeAgo } from './relativeTime';

/**
 * "Near you" — the once-daily digest. §4.1, D11, CONTENT_POLICY §4.4 and §5.
 *
 * What this surface is NOT: a feed. It is finite, it ends, and it says so.
 * There is no cursor, no pagination and nothing that loads as you scroll
 * (§5). Most days it shows "Nothing notable near you", and that is the
 * designed first-class screen rather than a fallback — the index going green
 * is a feature.
 *
 * Commerce may never appear here (§7.5), which is enforced by the ordering
 * module importing no offer type and by a test on this surface.
 *
 * Takes the index rather than reading it: the rail reports the same signal
 * count, and two components reading the same digest independently is two
 * places for them to disagree.
 */

const BAND_LABEL: Record<ThreatBand, string> = {
  quiet: t('band.quiet'),
  elevated: t('band.elevated'),
  active: t('band.active'),
};

/**
 * Publisher names for the signal sources, for the unreachable line. Short
 * enough to sit in a status line, and the name the reader would recognise if
 * they went looking — "NWS", not "nws".
 */
const SOURCE_LABEL: Readonly<Record<string, string>> = {
  nws: 'NWS alerts',
  usgs: 'USGS earthquakes',
  'wildfire-air': 'AirNow air quality',
  openfema: 'FEMA declarations',
  swpc: 'NOAA space weather',
};

function Signal({ signal, now }: { signal: ThreatSignal; now: Date }) {
  const stale = isStale(signal, now);

  return (
    <article className="card signal reveal" data-level={signal.level}>
      <p className="signal__source">
        {signal.sourceName}
        <span className="meta">
          {' · '}
          {timeAgo(signal.observedAt, now)}
          {stale ? ' · past its freshness window' : ''}
        </span>
      </p>

      <strong>{signal.headline}</strong>

      <p className="signal__means">
        <span className="signal__means-label">{t('threat.whatThisMeans')}</span>
        {signal.meansForYou}
      </p>

      {/* The direct link is mandatory (§4.4): every claim here is someone
          else's, and the reader gets to go and check it. */}
      <p className="meta" style={{ margin: '8px 0 0' }}>
        <a href={signal.url} target="_blank" rel="noreferrer noopener">
          {t('threat.source')}: {signal.sourceName}
        </a>
      </p>
    </article>
  );
}

export function NearYou({
  index,
  loading,
  now,
}: {
  index: ThreatIndex;
  loading: boolean;
  now: Date;
}) {
  return (
    <>
      <h2>
        <span className="margin-note" aria-hidden="true">
          what reported
        </span>
        Near you
      </h2>

      {loading ? (
        <p className="meta">Reading the last digest…</p>
      ) : (
        <>
          <div className="band" data-band={index.band}>
            <span className="band__label">{BAND_LABEL[index.band]}</span>
            <span className="meta band__confidence">
              {t('band.confidence', {
                reporting: index.reportingCount,
                total: index.sourceCount,
              })}
              {index.staleFor.length > 0
                ? ` · ${t('band.stale', { n: index.staleFor.length })}`
                : ''}
              {/* Named rather than subtracted. The publisher has always
                  written `unreachable` into the digest and nothing read it, so
                  a reader whose county lost its weather alerts saw only a
                  smaller fraction and no reason for it. */}
              {index.missing.length > 0
                ? ` · ${t('band.missing', {
                    names: index.missing.map((id) => SOURCE_LABEL[id] ?? id).join(', '),
                  })}`
                : ''}
            </span>
          </div>

          {/* The band justifies itself on demand. A judgment nobody can
              inspect is indistinguishable from a number we made up, which is
              the thing D11 rejected. Native disclosure: no JS, no library. */}
          <details className="band__why">
            <summary>{t('band.why')}</summary>
            <ul>
              {index.reasons.map((reason, i) => (
                <li key={`${reason.source ?? 'rule'}-${i}`}>{reason.text}</li>
              ))}
            </ul>
          </details>

          {index.isSample && <p className="caution band__sample">{t('band.sample')}</p>}

          {index.notable.length === 0 ? (
            <div className="empty reveal">
              <strong>{t('threat.nothingNotable')}</strong>
              {t('threat.nothingNotable.body')}
            </div>
          ) : (
            index.notable.map((signal) => (
              <Signal key={signal.source} signal={signal} now={now} />
            ))
          )}

          <p className="meta">{t('threat.digestEnds')}</p>
        </>
      )}
    </>
  );
}
