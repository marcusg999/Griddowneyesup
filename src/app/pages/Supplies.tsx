import { useState } from 'react';
import { t } from '@/i18n';
import { useContent } from '@/state/content';
import { useSupply } from '@/features/supply/useSupply';
import { useReadiness } from '@/state/readiness';
import { acquisitionPath } from '@/features/supply/recommend';
import { attachOffers } from '@/features/commerce/offers';
import { Offers } from '@/ui/Offers';
import { rotationQueue, suggestedExpiry } from '@/features/supply/rotation';
import { useAchievements } from '@/features/supply/useAchievements';
import { achievementBySlug } from '@/features/supply/achievements';
import type { KitId } from '@/content/types';

export function Supplies() {
  const { pack } = useContent();
  const { inventory, ladder, loading, addItem, removeItem, profile } = useSupply();
  const { state, suppressGamification } = useReadiness();
  const [selectedKit, setSelectedKit] = useState<KitId>('edc');
  const [itemId, setItemId] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const { earned, standing } = useAchievements(profile, inventory);

  if (loading || !pack) return <p className="lede">Reading your inventory…</p>;

  const byId = new Map(pack.items.map((i) => [i.id, i]));
  const kit = pack.kits.find((k) => k.id === selectedKit);
  const rotation = rotationQueue(inventory, pack.items);

  return (
    <>
      <p className="kicker">Inventory · {inventory.length} records</p>
      <h1>{t('nav.supplies')}</h1>
      <p className="lede">
        One record, many kits. Add something once and every kit it belongs to counts it.
      </p>

      {!suppressGamification && (
        <>
          <h2>
            <span className="margin-note" aria-hidden="true">
              climb down
            </span>
            The ladder down
          </h2>
          <p className="meta" style={{ marginTop: -4 }}>
            You start at the top, in your pockets, and climb down into safety. Each rung
            below you is deeper cover for longer — and each one is meant to be an easy
            win, which is the whole point of going in this order.
          </p>
          <ol className="ladder">
            {ladder.map(({ status, locked, prerequisite }) => (
              <li
                className="ladder__step"
                key={status.kit.id}
                data-locked={locked}
                data-complete={status.complete}
              >
                {/* On the step, not inside the card: .card's clip-path (the
                    trimmed corner) clips pseudo-elements and children alike,
                    and the marginalia sit at a negative offset, so a note
                    inside the card never rendered at all. */}
                <span className="margin-note" aria-hidden="true">
                  rung {status.kit.rung}
                </span>
                <div className="card rung reveal" data-locked={locked}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{status.kit.name}</strong>
                    {status.complete && <span className="pill">{t('kit.complete')}</span>}
                    {locked && <span className="pill">{t('kit.locked')}</span>}
                    <span className="meta" style={{ marginLeft: 'auto' }}>
                      {status.present}/{status.total}
                    </span>
                  </div>
                  <p className="meta" style={{ margin: '4px 0 0' }}>
                    {status.kit.scenario} · {status.kit.horizon}
                  </p>
                  {locked && prerequisite && (
                    <p className="meta" style={{ margin: '6px 0 0' }}>
                      {t('kit.locked.hint', { prereq: prerequisite.name })}
                    </p>
                  )}
                  {status.missingCritical.length > 0 && (
                    <p className="caution" style={{ marginTop: 8 }}>
                      {t('kit.criticalMissing', { n: status.missingCritical.length })}:{' '}
                      {status.missingCritical
                        .map((id) => byId.get(id)?.name ?? id)
                        .join(', ')}
                    </p>
                  )}
                  <div className="rung__bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(status.fraction * 100)}%` }} />
                  </div>
                  {status.weightG !== undefined && status.weightG > 0 && (
                    <WeightLine
                      weightG={status.weightG}
                      budgetG={status.weightBudgetG}
                      overG={status.overBudgetG}
                    />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Not rendered at all in Grey Sky, rather than hidden with CSS.
          Shopping is not a Grey Sky activity, and a purchase link that is
          merely invisible is still a purchase link in the document. */}
      {state !== 'grey-sky' && (
        <>
          <h2>
            <span className="margin-note" aria-hidden="true">
              cheapest first
            </span>
            What to buy next
          </h2>
          <p className="meta" style={{ marginTop: -6 }}>
            Ordered by what a dollar buys you in survival terms, cheapest tier first. The
            order is computed before any commerce data is attached and does not depend on
            it.
          </p>
          <AcquisitionTiers
            items={pack.items}
            held={new Set(inventory.map((r) => r.itemId))}
            offers={pack.offers}
          />
        </>
      )}

      <h2>
        <span className="margin-note" aria-hidden="true">
          log it
        </span>
        Add something
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!itemId) return;
          // Deliberately keeps the selection: adding four gallons of water is
          // a normal thing to do and should not need re-choosing each time.
          void addItem(itemId, 1, [selectedKit], expiresOn || undefined);
        }}
      >
        <label className="meta" htmlFor="kit-select">
          Which kit
        </label>
        <select
          id="kit-select"
          className="search"
          value={selectedKit}
          onChange={(event) => setSelectedKit(event.target.value as KitId)}
        >
          {pack.kits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>

        <label className="meta" htmlFor="item-select" style={{ marginTop: 12, display: 'block' }}>
          What
        </label>
        <select
          id="item-select"
          className="search"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
        >
          <option value="">Choose an item…</option>
          {(kit ? pack.items.filter((i) => kit.baseItems.includes(i.id)) : pack.items).map(
            (item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ),
          )}
        </select>

        <label className="meta" htmlFor="expiry" style={{ marginTop: 12, display: 'block' }}>
          Expires (optional)
        </label>
        <input
          id="expiry"
          className="search"
          type="date"
          value={expiresOn}
          onChange={(event) => setExpiresOn(event.target.value)}
        />
        {itemId && suggestedExpiry(byId.get(itemId)) && !expiresOn && (
          <button
            type="button"
            className="btn btn--ghost"
            style={{ minHeight: 36, padding: '4px 12px', marginTop: 8 }}
            onClick={() => setExpiresOn(suggestedExpiry(byId.get(itemId)) ?? '')}
          >
            Use typical shelf life ({suggestedExpiry(byId.get(itemId))})
          </button>
        )}

        <button className="btn" type="submit" style={{ marginTop: 12, display: 'block' }} disabled={!itemId}>
          Add to {kit?.name ?? 'kit'}
        </button>
      </form>

      {rotation.length > 0 && !suppressGamification && (
        <>
          <h2>
            <span className="margin-note" aria-hidden="true">
              use these
            </span>
            Rotation
          </h2>
          <p className="meta" style={{ marginTop: -6 }}>
            Still good today. That is the point of catching them now.
          </p>
          <ul className="rotation">
            {rotation.map((entry) => (
              <li key={entry.record.id} data-bucket={entry.bucket}>
                <span className="rotation__when tnum">
                  {entry.daysRemaining < 0
                    ? `${Math.abs(entry.daysRemaining)}d past`
                    : `${entry.daysRemaining}d`}
                </span>
                <span>
                  <strong>{entry.item?.name ?? entry.record.itemId}</strong>
                  <small>
                    {entry.bucket === 'expired'
                      ? 'Past its date — it no longer counts toward your coverage.'
                      : 'Use it, then replace it.'}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {standing.length > 0 && !suppressGamification && (
        <>
          <h2>
            <span className="margin-note" aria-hidden="true">
              right now
            </span>
            True today
          </h2>
          <ul className="badges">
            {standing.map((slug) => {
              const def = achievementBySlug.get(slug);
              if (!def) return null;
              return (
                <li key={slug} data-testid="achievement" data-standing="true">
                  <strong>{def.name}</strong>
                  <small>{def.note}</small>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {earned.length > 0 && !suppressGamification && (
        <>
          <h2>
            <span className="margin-note" aria-hidden="true">
              earned
            </span>
            Done
          </h2>
          <ul className="badges">
            {earned.map((a) => {
              const def = achievementBySlug.get(a.slug as never);
              if (!def) return null;
              return (
                <li key={a.slug} data-testid="achievement">
                  <strong>{def.name}</strong>
                  <small>{def.note}</small>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2>
        <span className="margin-note" aria-hidden="true">
          on hand
        </span>
        What you have
      </h2>
      {inventory.length === 0 ? (
        <div className="empty">
          <strong>Empty</strong>
          {t('empty.supplies')}
        </div>
      ) : (
        inventory.map((record) => {
          const item = byId.get(record.itemId);
          return (
            <div className="card reveal" key={record.id} data-testid="inventory-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{item?.name ?? record.itemId}</strong>
                <span className="meta">
                  ×{record.quantity} {item?.unit ?? ''}
                </span>
                <button
                  className="btn btn--ghost"
                  type="button"
                  style={{ marginLeft: 'auto', minHeight: 36, padding: '4px 12px' }}
                  onClick={() => void removeItem(record.id)}
                  aria-label={`Remove ${item?.name ?? record.itemId}`}
                >
                  Remove
                </button>
              </div>
              <p className="meta" style={{ margin: '4px 0 0' }}>
                {item?.spec}
              </p>
              <p className="meta" style={{ margin: '4px 0 0' }}>
                In: {record.kits.join(', ')}
              </p>
            </div>
          );
        })
      )}

      {profile.bodyweightKg === undefined && (
        <p className="meta" style={{ marginTop: 20 }}>
          Set your bodyweight in Settings and the carry-weight budget starts working.
          A bag you cannot walk a mile with is a bag you will put down.
        </p>
      )}
    </>
  );
}

/**
 * The cost-staged acquisition path. §4.2.
 *
 * Note the order of operations, which is the whole integrity story: the
 * ordering runs first, on items alone, and offers are attached to the result
 * afterwards. `attachOffers` takes an ordered list and maps over it, so there
 * is no step at which a commission could move anything.
 */
function AcquisitionTiers({
  items,
  held,
  offers,
}: {
  items: readonly import('@/content/types').CatalogItem[];
  held: ReadonlySet<string>;
  offers: readonly import('@/content/types').Offer[];
}) {
  const tiers = acquisitionPath(items, held);

  return (
    <>
      {tiers.map((tier) => {
        const decorated = attachOffers(tier.items, offers);
        if (decorated.length === 0) return null;
        return (
          <section className="tier reveal" key={tier.tier}>
            <div className="tier__head">
              <span className="tier__label">{tier.label}</span>
              <span className="tier__spend tnum">
                {tier.items.length} items ·{' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(tier.spendCents / 100)}
              </span>
            </div>
            {decorated.map(({ subject, offers: itemOffers }) => (
              <div className="tier__item" key={subject.id}>
                <strong>{subject.name}</strong>
                <p>{subject.spec}</p>
                <Offers offers={itemOffers} surface="acquisition" />
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}

function WeightLine({
  weightG,
  budgetG,
  overG,
}: {
  weightG: number;
  budgetG: number | undefined;
  overG: number | undefined;
}) {
  const kg = (weightG / 1000).toFixed(1);

  if (budgetG === undefined) {
    return (
      <p className="meta" style={{ margin: '6px 0 0' }}>
        {t('weight.heading')}: {kg} kg
      </p>
    );
  }

  const percent = Math.round((weightG / (budgetG / 0.2)) * 100);

  return (
    <p
      className={overG ? 'caution' : 'meta'}
      style={{ margin: '6px 0 0' }}
      data-testid="weight-line"
    >
      {t('weight.heading')}: {kg} kg — {t('weight.ofBodyweight', { percent })}
      {overG !== undefined && ` · ${t('weight.overBudget', { amount: `${(overG / 1000).toFixed(1)} kg` })}`}
    </p>
  );
}
