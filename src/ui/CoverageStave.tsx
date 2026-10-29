/**
 * A sounding stave: days plotted against a ruled scale.
 *
 * Drawn rather than described, because "4" means very little until you can see
 * it against 3 days and against 14. The scale is the point.
 */
export function CoverageStave({
  days,
  target,
  thin,
}: {
  days: number;
  target: number;
  thin: boolean;
}) {
  const MAX = 30;
  const w = 100;
  const clamp = (n: number) => Math.max(0, Math.min(MAX, n));
  const x = (n: number) => (clamp(n) / MAX) * w;

  const ticks = Array.from({ length: MAX + 1 }, (_, i) => i);
  const colour = thin ? 'var(--stamp)' : 'var(--acid)';

  return (
    <svg
      className="stave"
      viewBox={`0 0 ${w} 14`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Baseline the measure sits on. */}
      <line x1="0" x2={w} y1="10" y2="10" stroke="var(--rule-major)" strokeWidth="1"
        vectorEffect="non-scaling-stroke" />

      {ticks.map((i) => (
        <line
          key={i}
          x1={x(i)}
          x2={x(i)}
          y1={i % 7 === 0 ? 5.5 : 8}
          y2="10"
          stroke="var(--rule-major)"
          strokeWidth={i % 7 === 0 ? 1 : 1}
          opacity={i % 7 === 0 ? 1 : 0.45}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* The measured depth, sitting on the baseline. */}
      <rect x="0" y="5.6" width={x(days)} height="4.4" fill={colour} />

      {/* Where the household said it wanted to be. */}
      <line
        x1={x(target)}
        x2={x(target)}
        y1="1.5"
        y2="13"
        stroke="var(--ink)"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(target)} cy="1.5" r="1.1" fill="var(--ink)" />
    </svg>
  );
}
