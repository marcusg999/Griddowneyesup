import type { Indicator } from '@/content/types';
import type { Profile } from '@/db/types';
import {
  exposureHeadline,
  householdExposure,
  money,
  percentChange,
  readingAgeDays,
} from '@/features/exposure/exposure';

const STATUS_LABEL: Record<Indicator['epistemicStatus'], string> = {
  official: 'Official source',
  'press-reported': 'Press reported — no primary source',
  mixed: 'Official source, relayed reading',
};

/**
 * Economic exposure. §4.1 supply-chain module.
 *
 * Three things, in this order and no other:
 *   1. What is measured, with its source, its date and its age.
 *   2. How it reaches a household — as a chain of inspectable links, never a
 *      narrative paragraph, because a paragraph is the implied narrative §4.1
 *      forbids and a chain is a model you can disagree with one link at a time.
 *   3. What it costs THIS household, as arithmetic on their own figures.
 *
 * And one thing that is deliberately absent: anything to buy. Pairing a price
 * shock with a purchase link is fear as a conversion mechanic (§6). Offers are
 * confined to the acquisition surfaces and cannot render here.
 */
export function Exposure({
  indicator,
  profile,
}: {
  indicator: Indicator;
  profile: Profile;
}) {
  const change = percentChange(indicator);
  const age = readingAgeDays(indicator);
  const exposure = householdExposure(indicator, profile);
  const headline = exposureHeadline(exposure);

  return (
    <article className="exposure">
      <p className="exposure__status">
        {STATUS_LABEL[indicator.epistemicStatus]} · read {indicator.asOf}
        {age > 0 && ` · ${age} ${age === 1 ? 'day' : 'days'} old`}
      </p>

      <div className="exposure__reading">
        <span className="exposure__value tnum">
          {indicator.current.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </span>
        <span className="exposure__meta">
          {indicator.unit}
          <small>
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}% vs {indicator.baseline.label} (
            {indicator.baseline.value.toLocaleString('en-US', { maximumFractionDigits: 2 })})
          </small>
        </span>
      </div>

      <h3 className="exposure__name">{indicator.name}</h3>
      <p>{indicator.whatItIs}</p>

      {indicator.reported && (
        <p className="exposure__reported">
          <strong>Reading relayed, not read from source.</strong> {indicator.reported}
        </p>
      )}

      <h4 className="exposure__sub">How it reaches you</h4>
      <ol className="chain">
        {indicator.transmission.map((link) => (
          <li key={`${link.from}-${link.to}`}>
            <div className="chain__head">
              <span className="chain__node">{link.from}</span>
              <span className="chain__arrow" aria-hidden="true">
                →
              </span>
              <span className="chain__node">{link.to}</span>
              <span className="chain__lag">{link.lag}</span>
            </div>
            <p className="chain__note">{link.note}</p>
          </li>
        ))}
      </ol>

      <h4 className="exposure__sub">What it costs your household</h4>
      {exposure.needsInput ? (
        <p className="meta">
          Add your monthly fuel and grocery spend in Settings and this becomes arithmetic
          on your own numbers. Without them there is nothing honest to compute.
        </p>
      ) : (
        <>
          <ul className="exposure__lines">
            {exposure.lines.map((line) => (
              <li key={line.label}>
                <span className="exposure__line-amount tnum">
                  {line.lowCents === line.highCents
                    ? `${money(line.lowCents)}`
                    : `${money(line.lowCents)}–${money(line.highCents)}`}
                </span>
                <span className="exposure__line-body">
                  <strong>{line.label}</strong>
                  <small>{line.basis}</small>
                  {line.caveat && <small className="exposure__caveat">{line.caveat}</small>}
                </span>
              </li>
            ))}
          </ul>
          <p className="exposure__total">
            About{' '}
            <strong>
              {exposure.totalLowCents === exposure.totalHighCents
                ? money(exposure.totalLowCents)
                : `${money(exposure.totalLowCents)}–${money(exposure.totalHighCents)}`}
            </strong>{' '}
            a month more than at the baseline.
            {headline && <> {headline}</>}
          </p>
        </>
      )}

      <p className="exposure__exit">
        <strong>What would end this:</strong> {indicator.wouldChangeThis}
      </p>

      <p>{indicator.whatItMeansForYou}</p>

      <ul className="posture__sources meta">
        {indicator.citations.map((c) => (
          <li key={c.title}>
            {c.source}, <em>{c.title}</em> ({c.published})
            {c.url && (
              <>
                {' · '}
                <a href={c.url} rel="noreferrer noopener" target="_blank">
                  source
                </a>
              </>
            )}
          </li>
        ))}
        {indicator.pressCitations?.map((c) => (
          <li key={c.title}>
            Press: {c.source}, <em>{c.title}</em> ({c.published})
          </li>
        ))}
      </ul>
    </article>
  );
}
