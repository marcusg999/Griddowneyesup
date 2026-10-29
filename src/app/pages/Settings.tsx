import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useContent } from '@/state/content';
import { useReadiness, type ReadinessState } from '@/state/readiness';
import { useSupply } from '@/features/supply/useSupply';
import { store } from '@/db';
import { brand } from '@/config/brand';

export function Settings() {
  const { state, setState } = useReadiness();
  const { pack } = useContent();
  const { profile, reload } = useSupply();
  const [bodyweight, setBodyweight] = useState('');

  useEffect(() => {
    setBodyweight(profile.bodyweightKg ? String(profile.bodyweightKg) : '');
  }, [profile.bodyweightKg]);

  const states: Array<{ id: ReadinessState; label: string; hint: string }> = [
    { id: 'blue-sky', label: t('state.blueSky'), hint: t('state.blueSky.summary') },
    { id: 'watch', label: t('state.watch'), hint: t('state.watch.summary') },
    { id: 'grey-sky', label: t('state.greySky'), hint: t('state.greySky.summary') },
  ];

  return (
    <>
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
