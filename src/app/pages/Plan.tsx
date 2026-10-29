import { t } from '@/i18n';

/**
 * Plan builder. Build order step 3.
 *
 * Deliberately honest about not existing yet rather than showing a fake
 * skeleton. The route exists and navigates because the offline suite walks
 * every route, and because a dead link is worse than an empty page.
 */
export function Plan() {
  return (
    <>
      <p className="kicker">Household · not yet drafted</p>
      <h1>{t('nav.plan')}</h1>
      <p className="lede">{t('empty.plan')}</p>

      <div className="empty">
        <strong>Not built yet</strong>
        <p style={{ margin: '8px 0 0' }}>
          The plan builder is step 3. It produces rally points, an out-of-area contact,
          evacuation routes with alternates, utility shutoff locations, and the
          wallet-sized card you print and carry.
        </p>
      </div>

      <h2>
        <span className="margin-note" aria-hidden="true">
          on paper
        </span>
        Why this one gets printed
      </h2>
      <p>
        The most likely failure in an emergency is a dead phone, and this app lives on a
        phone. Paper does not need charging, does not need a signal, and does not need
        you to remember a passcode with cold hands.
      </p>
    </>
  );
}
