import type { CatalogItem, ResourceKind } from '@/content/types';
import type { Coverage } from '@/features/supply/coverage';
import { HORIZONS, horizonPlan, nearestHorizon } from '@/features/supply/horizon';

/**
 * The horizon dial, and the bill that comes with it.
 *
 * The standing advice to households is 72 hours. The posture note (§9)
 * observes that the institutions planning for the same events plan in months,
 * and argues the gap is worth arguing with. This is where that argument stops
 * being rhetoric: pick ninety days and the app tells you, in containers and
 * kilograms and dollars, what ninety days actually is.
 *
 * It is deliberately not encouraging. The weight is not rounded down and the
 * cost is not hidden, because a household that finds out ninety days of water
 * is a quarter of a tonne has learned something true — and learned it with
 * time to do something about it.
 */

const RESOURCE_LABEL: Readonly<Record<ResourceKind, string>> = {
  'water-litres': 'water',
  'calories-kcal': 'food',
  'heat-hours': 'heat',
  'power-wh': 'power',
  'sanitation-uses': 'sanitation',
};

const UNIT_LABEL: Readonly<Record<ResourceKind, string>> = {
  'water-litres': 'L',
  'calories-kcal': 'kcal',
  'heat-hours': 'h',
  'power-wh': 'Wh',
  'sanitation-uses': 'uses',
};

const kg = (grams: number): string =>
  grams >= 1_000 ? `${(grams / 1_000).toFixed(grams >= 10_000 ? 0 : 1)} kg` : `${grams} g`;

const money = (cents: number): string => `$${(cents / 100).toFixed(cents >= 10_000 ? 0 : 2)}`;

export function Horizon({
  coverage,
  catalog,
  targetDays,
  onChange,
}: {
  readonly coverage: readonly Coverage[];
  readonly catalog: readonly CatalogItem[];
  readonly targetDays: number;
  readonly onChange: (days: number) => void;
}) {
  const selected = nearestHorizon(targetDays);
  const plan = horizonPlan(coverage, catalog, selected);

  return (
    <section className="horizon-plan">
      {/* The same chip row the Skills browser uses. A control that behaves
          like another control the reader has already met is one fewer thing
          to learn. */}
      <div className="browse" role="group" aria-label="Target horizon">
        {HORIZONS.map((days) => (
          <button
            type="button"
            key={days}
            className="browse__chip"
            aria-pressed={days === selected}
            onClick={() => onChange(days)}
          >
            {days}
            <span className="browse__n">{days === 1 ? 'day' : 'days'}</span>
          </button>
        ))}
      </div>

      {plan.met ? (
        <p className="horizon-plan__met">
          <strong>You are already there.</strong> Everything your household needs daily is
          stocked past {selected} days. The number to watch now is the expiry dates, not
          the shelf.
        </p>
      ) : (
        <>
          <table className="horizon-table">
            <caption className="meta">
              What {selected} days asks for, against what is on the shelf. One item per
              gap, chosen by what a dollar buys in survival terms and nothing else.
            </caption>
            <thead>
              <tr>
                <th scope="col">Short of</th>
                <th scope="col">Gap</th>
                <th scope="col">Buy</th>
                <th scope="col">Weight</th>
                <th scope="col">Cost</th>
              </tr>
            </thead>
            <tbody>
              {plan.shortfalls
                .filter((shortfall) => !shortfall.met)
                .map((shortfall) => {
                  const line = plan.buy.find((b) => b.resource === shortfall.resource);
                  return (
                    <tr key={shortfall.resource}>
                      <th scope="row">{RESOURCE_LABEL[shortfall.resource]}</th>
                      <td className="tnum">
                        {Math.ceil(shortfall.gap).toLocaleString()}{' '}
                        {UNIT_LABEL[shortfall.resource]}
                      </td>
                      <td>
                        {line ? (
                          <>
                            <span className="tnum">{line.units}</span> × {line.item.name}
                          </>
                        ) : (
                          // The catalog has nothing that provides it. Saying
                          // "buy something" would be worse than saying nothing.
                          <span className="meta">nothing in the catalogue covers this</span>
                        )}
                      </td>
                      <td className="tnum">{line ? kg(line.addedWeightG) : '—'}</td>
                      <td className="tnum">
                        {line?.addedCostCents === undefined
                          ? '—'
                          : money(line.addedCostCents)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>
                  To reach {selected} days
                </th>
                <td className="tnum">{kg(plan.totalWeightG)}</td>
                <td className="tnum">
                  {plan.pricedLines === 0 ? '—' : money(plan.totalCostCents)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Never round a partial total up into a whole one. */}
          {plan.pricedLines > 0 && plan.pricedLines < plan.buy.length && (
            <p className="meta">
              Cost covers {plan.pricedLines} of {plan.buy.length} lines — the rest have no
              typical price in the catalogue, so the real total is higher than this.
            </p>
          )}

          <p className="meta">
            Typical prices, not quotes, and no purchase links: the ordering above is
            computed before any commerce data exists and does not depend on it.
          </p>
        </>
      )}
    </section>
  );
}
