import type { PostureNote } from '@/content/types';

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
export function Posture({ note, targetDays }: { note: PostureNote; targetDays: number }) {
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
        <div className="horizon">
          <div className="horizon__pair">
            <span className="horizon__n tnum">{targetDays}</span>
            <span className="horizon__label">
              days
              <small>your target</small>
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
