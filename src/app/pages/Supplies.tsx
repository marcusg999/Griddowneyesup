import { useState } from 'react';
import { t } from '@/i18n';
import { useContent } from '@/state/content';
import { useSupply } from '@/features/supply/useSupply';
import { useReadiness } from '@/state/readiness';
import { weightTradeoff } from '@/features/supply/kits';
import type { KitId } from '@/content/types';

export function Supplies() {
  const { pack } = useContent();
  const { inventory, ladder, loading, addItem, removeItem, profile } = useSupply();
  const { suppressGamification } = useReadiness();
  const [selectedKit, setSelectedKit] = useState<KitId>('edc');
  const [itemId, setItemId] = useState('');

  if (loading || !pack) return <p className="lede">Reading your inventory…</p>;

  const byId = new Map(pack.items.map((i) => [i.id, i]));
  const kit = pack.kits.find((k) => k.id === selectedKit);

  return (
    <>
      <h1>{t('nav.supplies')}</h1>
      <p className="lede">
        One record, many kits. Add something once and every kit it belongs to counts it.
      </p>

      {!suppressGamification && (
        <>
          <h2>The ladder</h2>
          <p className="meta" style={{ marginTop: -4 }}>
            Start at the bottom. Each rung is meant to be an easy win, which is the
            whole point of doing it in this order.
          </p>
          {ladder.map(({ status, locked, prerequisite }) => (
            <div className="card" key={status.kit.id}>
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
                  {status.missingCritical.map((id) => byId.get(id)?.name ?? id).join(', ')}
                </p>
              )}
              {status.weightG !== undefined && status.weightG > 0 && (
                <WeightLine
                  weightG={status.weightG}
                  budgetG={status.weightBudgetG}
                  overG={status.overBudgetG}
                />
              )}
            </div>
          ))}
        </>
      )}

      <h2>Add something</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!itemId) return;
          // Deliberately keeps the selection: adding four gallons of water is
          // a normal thing to do and should not need re-choosing each time.
          void addItem(itemId, 1, [selectedKit]);
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

        <button className="btn" type="submit" style={{ marginTop: 12 }} disabled={!itemId}>
          Add to {kit?.name ?? 'kit'}
        </button>
      </form>

      <h2>What you have</h2>
      {inventory.length === 0 ? (
        <div className="empty">{t('empty.supplies')}</div>
      ) : (
        inventory.map((record) => {
          const item = byId.get(record.itemId);
          return (
            <div className="card" key={record.id} data-testid="inventory-row">
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

export { weightTradeoff };
