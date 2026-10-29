import { useEffect, useState } from 'react';
import type { Profile } from '@/db/types';
import { t } from '@/i18n';
import { useContent } from '@/state/content';
import { useReadiness, type ReadinessState } from '@/state/readiness';
import { useSupply } from '@/features/supply/useSupply';
import { store } from '@/db';
import { brand } from '@/config/brand';

function SpendField({
  id,
  label,
  cents,
  onSave,
}: {
  id: string;
  label: string;
  cents: number | undefined;
  onSave: (cents: number) => void;
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(cents !== undefined ? String(Math.round(cents / 100)) : '');
  }, [cents]);

  return (
    <p className="field">
      <label className="meta" htmlFor={id}>
        {label} (USD)
      </label>
      <input
        id={id}
        className="search"
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const dollars = Number(value);
          if (Number.isFinite(dollars) && dollars >= 0) onSave(Math.round(dollars * 100));
        }}
      />
    </p>
  );
}

/**
 * Clearing the field means "no county", which is the absence of the key rather
 * than a key holding an empty string — the digest region falls back to the
 * sample, and a stored empty string would select a file that does not exist.
 */
function omitCounty(profile: Profile): Profile {
  const { countyFips: _dropped, ...rest } = profile;
  return rest;
}

export function Settings() {
  const { state, setState } = useReadiness();
  const { pack } = useContent();
  const { profile, reload } = useSupply();
  const [bodyweight, setBodyweight] = useState('');

  useEffect(() => {
    setBodyweight(profile.bodyweightKg ? String(profile.bodyweightKg) : '');
  }, [profile.bodyweightKg]);

  const [county, setCounty] = useState('');
  useEffect(() => {
    setCounty(profile.countyFips ?? '');
  }, [profile.countyFips]);

  const states: Array<{ id: ReadinessState; label: string; hint: string }> = [
    { id: 'blue-sky', label: t('state.blueSky'), hint: t('state.blueSky.summary') },
    { id: 'watch', label: t('state.watch'), hint: t('state.watch.summary') },
    { id: 'grey-sky', label: t('state.greySky'), hint: t('state.greySky.summary') },
  ];

  return (
    <>
      <p className="kicker">Device · no account, nothing sent anywhere</p>
      <h1>{t('nav.settings')}</h1>

      <h2>Readiness state</h2>
      <p className="meta" style={{ marginTop: -4 }}>
        Normally this follows the threat index. You can always set it by hand, and in
        Grey Sky the interface strips down to four things.
      </p>
      {states.map((option) => (
        <button
          key={option.id}
          type="button"
          className="card card--link"
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
          aria-pressed={state === option.id}
          onClick={() => setState(option.id)}
          data-testid={`state-${option.id}`}
        >
          <strong>
            {option.label}
            {state === option.id ? ' ·  active' : ''}
          </strong>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            {option.hint}
          </p>
        </button>
      ))}

      {/* The digest is published per region, so without this there is no way
          to ask for your own. Stored in the profile, which is sensitive and
          never transmitted — the region is used to pick a filename, nothing
          more. */}
      <h2>Your county</h2>
      <label className="meta" htmlFor="county">
        County FIPS code, which selects the digest for your area. Leave it empty for the
        sample region. 06075 is San Francisco County, and is the second sample.
      </label>
      <input
        id="county"
        className="search"
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder="default"
        value={county}
        onChange={(event) => setCounty(event.target.value.replace(/\D/g, ''))}
      />
      <button
        className="btn"
        type="button"
        style={{ marginTop: 12 }}
        onClick={() => {
          const next = county.trim();
          void store.profile
            .put(next ? { ...profile, countyFips: next } : omitCounty(profile))
            .then(reload);
        }}
      >
        Save
      </button>

      <h2>Carry weight</h2>
      <label className="meta" htmlFor="bodyweight">
        Your bodyweight in kg. Mobile kits are budgeted at {Math.round(profile.carryFraction * 100)}% of it.
      </label>
      <input
        id="bodyweight"
        className="search"
        type="number"
        inputMode="decimal"
        min="20"
        max="250"
        value={bodyweight}
        onChange={(event) => setBodyweight(event.target.value)}
      />
      <button
        className="btn"
        type="button"
        style={{ marginTop: 12 }}
        onClick={() => {
          const kg = Number(bodyweight);
          if (!Number.isFinite(kg) || kg <= 0) return;
          void store.profile.put({ ...profile, bodyweightKg: kg }).then(reload);
        }}
      >
        Save
      </button>

      <h2>Monthly spend</h2>
      <p className="meta" style={{ marginTop: -4 }}>
        Used only to work out what an economic indicator costs your household. Stays on
        this device, like everything else, and the exposure section simply does not
        render without it rather than guessing at your numbers.
      </p>
      <SpendField
        id="fuel-spend"
        label="Fuel, per month"
        cents={profile.monthlyFuelSpendCents}
        onSave={(monthlyFuelSpendCents) =>
          void store.profile.put({ ...profile, monthlyFuelSpendCents }).then(reload)
        }
      />
      <SpendField
        id="grocery-spend"
        label="Groceries, per month"
        cents={profile.monthlyGrocerySpendCents}
        onSave={(monthlyGrocerySpendCents) =>
          void store.profile.put({ ...profile, monthlyGrocerySpendCents }).then(reload)
        }
      />

      <h2>Content</h2>
      <p className="meta">
        {pack
          ? `Pack ${pack.manifest.version} · ${pack.manifest.counts.skills} skills, ${pack.manifest.counts.items} items · installed on this device`
          : 'No content pack installed yet.'}
      </p>
      <p className="meta">
        The library lives on your device. Updates are verified before they replace what
        you already have, so a failed update leaves your working copy alone.
      </p>

      <h2>About</h2>
      <p className="meta">
        {brand.name} — {brand.tagline}. No account, no tracking, nothing sent anywhere.
      </p>
    </>
  );
}
