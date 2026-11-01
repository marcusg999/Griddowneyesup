import { useId, useState } from 'react';
import type { PostureNote } from '@/content/types';
import { HorizonDial } from './HorizonDial';

const STATUS_LABEL: Record<PostureNote['epistemicStatus'], string> = {
  official: 'Official source',
  'press-reported': 'Press reported — no primary source',
  mixed: 'Official announcement, reported detail',
};

/**
 * Standing posture. CONTENT_POLICY §9.
 *
 * Baseline context about the world, deliberately rendered as the opposite of
 * an alert: no colour, no urgency, no call to action, and a line saying in so
 * many words that it does not change the readiness state.
 *
 * The epistemic status is shown rather than flattened. "The Pentagon announced
 * a programme" and "press reporting on internal documents says 90 days" are
 * different kinds of claim, and an app that renders them identically is
 * lying by layout.
 */
export function Posture({
  note,
  targetDays,
  onChangeTarget,
}: {
  readonly note: PostureNote;
  readonly targetDays: number;
  /**
   * Omit to render the number as plain text. Passed in, rather than this
   * component reaching for the store itself, so a printed sheet and any
   * future read-only surface stay read-only by construction.
   */
  readonly onChangeTarget?: (days: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const dialId = useId();

  return (
    <article className="posture">
      <p className="posture__status">
        {STATUS_LABEL[note.epistemicStatus]} · {note.published}
      </p>

      <h3 className="posture__title">{note.title}</h3>

      <p>{note.whatItIs}</p>

      {note.reported && (
        <p className="posture__reported">
          <strong>Reported, not confirmed.</strong> {note.reported}
        </p>
      )}

      {note.horizonSignalDays !== undefined && (
        <>
          <div className="horizon">
            {/* Your number is the one you can do something about, so it is
                the one that is a control. Theirs is a reported fact and stays
                plain text — making it look pressable would imply this app can
                change what somebody else is planning for. */}
            <div className="horizon__pair">
              {onChangeTarget ? (
                <button
                  type="button"
                  className="horizon__n horizon__n--editable tnum"
                  aria-expanded={editing}
                  aria-controls={dialId}
                  onClick={() => setEditing((open) => !open)}
                >
                  {targetDays}
                </button>
              ) : (
                <span className="horizon__n tnum">{targetDays}</span>
              )}
              <span className="horizon__label">
                days
                <small>{onChangeTarget ? 'your target — tap to change' : 'your target'}</small>
              </span>
            </div>
            <div className="horizon__pair">
              <span className="horizon__n tnum" data-them="true">
                {note.horizonSignalDays}
              </span>
              <span className="horizon__label">
                days
                <small>theirs, reported</small>
              </span>
            </div>
          </div>

          {onChangeTarget && editing && (
            <div className="horizon__edit">
              <HorizonDial
                id={dialId}
                targetDays={targetDays}
                onChange={(days) => {
                  onChangeTarget(days);
                  // Left open on purpose. Changing the number is the point of
                  // this comparison, and closing on the first tap would make
                  // trying 30 against 90 and then 60 a three-tap job each
                  // time.
                }}
              />
              <p className="meta">
                The supply maths runs again on Supplies, where it says what the
                new horizon costs in things, weight and money.
              </p>
            </div>
          )}
        </>
      )}

      <p>{note.whatItMeansForYou}</p>

      <p className="posture__inert">
        This does not change your readiness state. Posture is measured in
        months; the state is about what is happening near you today.
      </p>

      <ul className="posture__sources meta">
        {note.citations.map((c) => (
          <li key={c.title}>
            {c.source}, <em>{c.title}</em> ({c.published})
          </li>
        ))}
        {note.pressCitations?.map((c) => (
          <li key={c.title}>
            Press: {c.source}, <em>{c.title}</em> ({c.published})
            {c.url && (
              <>
                {' · '}
                <a href={c.url} rel="noreferrer noopener" target="_blank">
                  link
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
