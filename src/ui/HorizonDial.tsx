import { HORIZONS, nearestHorizon } from '@/features/supply/horizon';

/**
 * The horizon dial, on its own.
 *
 * Extracted because the number now appears in two places — the planner on
 * Supplies and the comparison on Today, where a posture note puts your target
 * next to the horizon some institution is planning to. Both have to change
 * the same setting in the same way, and two copies of a chip row is two
 * places for the offered values to drift apart.
 *
 * The same chip row the Skills browser uses. A control that behaves like
 * another control the reader has already met is one fewer thing to learn.
 */
export function HorizonDial({
  targetDays,
  onChange,
  id,
}: {
  readonly targetDays: number;
  readonly onChange: (days: number) => void;
  /** Distinguishes the group when more than one dial is on a page. */
  readonly id?: string;
}) {
  const selected = nearestHorizon(targetDays);

  return (
    <div className="browse" role="group" aria-label="Target horizon" id={id}>
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
  );
}
