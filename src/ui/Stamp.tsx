/**
 * The rubber stamp.
 *
 * This is the one unmistakable moment in the contract, and it exists for a
 * content reason rather than a decorative one: the brief requires that what a
 * technique does NOT do is impossible to miss, and a stamp you have to scroll
 * through is the literal form of impossible to miss.
 *
 * The ink bleed is a real turbulence displacement on the stroke, not a blur —
 * a rubber stamp sits unevenly on paper and the edge is where you see it.
 */
export function Stamp({ line, tone = 'stamp' }: { line: string; tone?: 'stamp' | 'acid' }) {
  const colour = tone === 'acid' ? 'var(--acid)' : 'var(--stamp)';
  // Long lines wrap to two rows rather than shrinking into illegibility.
  const words = line.split(' ');
  const rows: string[] =
    line.length <= 14
      ? [line]
      : [
          words.slice(0, Math.ceil(words.length / 2)).join(' '),
          words.slice(Math.ceil(words.length / 2)).join(' '),
        ];

  return (
    <svg
      className="stamp"
      viewBox="0 0 440 180"
      role="img"
      aria-label={`Stamped: ${line}`}
      focusable="false"
    >
      <defs>
        <filter id="stamp-ink" x="-12%" y="-12%" width="124%" height="124%">
          {/* Rough the edge the way a rubber die rocks on paper. */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* Patchy ink: the die never loads evenly. */}
        <filter id="stamp-patch">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" seed="3" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.0"
          />
        </filter>
        <mask id="stamp-mask">
          <rect width="440" height="180" fill="#fff" />
          <rect width="440" height="180" filter="url(#stamp-patch)" opacity="0.5" />
        </mask>
      </defs>

      <g
        filter="url(#stamp-ink)"
        mask="url(#stamp-mask)"
        stroke={colour}
        fill="none"
        strokeWidth="4"
      >
        <rect x="12" y="12" width="416" height="156" rx="6" />
        <rect x="24" y="24" width="392" height="132" rx="3" strokeWidth="2" />
      </g>

      <g mask="url(#stamp-mask)" filter="url(#stamp-ink)" fill={colour}>
        {rows.map((row, i) => (
          <text
            key={row}
            x="220"
            y={rows.length === 1 ? 108 : 86 + i * 46}
            textAnchor="middle"
            fontFamily="RedactionStamp, var(--display)"
            fontWeight="700"
            fontSize={rows.length === 1 ? 54 : 42}
            letterSpacing="2"
          >
            {row.toUpperCase()}
          </text>
        ))}
      </g>
    </svg>
  );
}
