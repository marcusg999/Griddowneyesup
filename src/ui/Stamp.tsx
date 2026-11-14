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
/**
 * How the die is laid out, for a line of any length.
 *
 * The first version split into two rows by WORD count whenever the line was
 * longer than 14 characters, and then drew both at a fixed size. That silently
 * overflowed. Measured against the real font, "NEEDS OTHER NODES" at the
 * two-row size is 519 units wide inside a 440-unit die: it ran off both ends
 * and a phone clipped it to "EEDS OTHER NOD". It was not only the long lines —
 * "WEAK ON CRYPTO" and "NEVER TASTE IT" were already escaping the viewBox, and
 * several more were overflowing the inner rule. The stamp is the one thing in
 * this app that must be impossible to misread, so this is the bug that matters
 * most on the page.
 *
 * Three things changed. Rows are balanced by CHARACTER count rather than word
 * count, because "Needs other nodes" / "to exist" is an even split of five
 * words and a wildly uneven split of the width. A third row is allowed. And
 * the size steps down as rows are added, so a long line gets smaller instead
 * of wider.
 *
 * The fit is estimated rather than measured, so it works on the first paint,
 * before the webfont has loaded, and in print. The ratio below is the widest
 * per-character width observed across the real stamps which makes
 * the estimate deliberately pessimistic — a stamp a
 * size smaller than it strictly needed is a cost worth paying to never clip
 * one again. `textLength` is kept as a last resort for a single word too long
 * to fit at any size, where there is nothing left to wrap.
 */

/** The inner rule runs 24..416; this leaves a margin inside it. */
const FIT_WIDTH = 360;

/**
 * Width of one character: a share of the em, plus the flat letter-spacing.
 *
 * Letter-spacing is a fixed 2 units per character whatever the size, so
 * folding it into an em ratio over-charges large text and under-charges
 * small. Measured against the real font the em share runs 0.69 at size 54 and
 * 0.75 at 42, so 0.75 is the pessimistic one. Checked against the stamps that
 * exist: this over-estimates "NEEDS OTHER NODES" by 10% and lands within 1%
 * of "REMOVES", which is the margin wanted — erring towards a size smaller.
 */
const EM_SHARE = 0.75;
const LETTER_SPACING = 2;

const estimate = (chars: number, fontSize: number): number =>
  chars * (fontSize * EM_SHARE + LETTER_SPACING);

const LAYOUT = [
  { rows: 1, fontSize: 54, baselines: [108] },
  { rows: 2, fontSize: 42, baselines: [86, 132] },
  { rows: 3, fontSize: 32, baselines: [65, 101, 137] },
] as const;

/** Split into exactly `n` rows, keeping the rows as even in width as possible. */
export function balance(line: string, n: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (n <= 1 || words.length <= 1) return [words.join(' ') || line];
  if (words.length <= n) return words;

  // Walk every way of cutting the word list into n parts and keep the one
  // whose longest row is shortest. The lines here are a handful of words, so
  // this is cheap and exact where a greedy pass would not be.
  let best: string[] | undefined;
  const cuts = (start: number, left: number, acc: number[]): void => {
    if (left === 1) {
      const idx = [...acc, words.length];
      const rows: string[] = [];
      let from = 0;
      for (const to of idx) {
        rows.push(words.slice(from, to).join(' '));
        from = to;
      }
      if (rows.some((r) => r.length === 0)) return;
      const widest = Math.max(...rows.map((r) => r.length));
      const bestWidest = best ? Math.max(...best.map((r) => r.length)) : Infinity;
      if (widest < bestWidest) best = rows;
      return;
    }
    for (let i = start + 1; i <= words.length - left + 1; i += 1) {
      cuts(i, left - 1, [...acc, i]);
    }
  };
  cuts(0, n, []);
  return best ?? [line];
}

/** The first layout whose widest row fits, or the smallest one if none does. */
export function fit(line: string): {
  rows: string[];
  fontSize: number;
  baselines: readonly number[];
} {
  for (const option of LAYOUT) {
    const rows = balance(line, option.rows);
    const widest = Math.max(...rows.map((r) => r.length));
    if (estimate(widest, option.fontSize) <= FIT_WIDTH) {
      return { rows, fontSize: option.fontSize, baselines: option.baselines };
    }
  }
  const last = LAYOUT[LAYOUT.length - 1]!;
  return { rows: balance(line, last.rows), fontSize: last.fontSize, baselines: last.baselines };
}

export function Stamp({ line, tone = 'stamp' }: { line: string; tone?: 'stamp' | 'acid' }) {
  const colour = tone === 'acid' ? 'var(--acid)' : 'var(--stamp)';
  const { rows, fontSize, baselines } = fit(line);

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
        {rows.map((row, i) => {
          // Only when a row cannot be made to fit by wrapping — one long word
          // — is the text squeezed. Squeezing anything that fits would make
          // the die look stretched for no reason.
          const tooWide = estimate(row.length, fontSize) > FIT_WIDTH;
          return (
            <text
              key={row}
              x="220"
              y={baselines[i] ?? 108}
              textAnchor="middle"
              fontFamily="RedactionStamp, var(--display)"
              fontWeight="700"
              fontSize={fontSize}
              letterSpacing="2"
              {...(tooWide ? { textLength: FIT_WIDTH, lengthAdjust: 'spacingAndGlyphs' } : {})}
            >
              {row.toUpperCase()}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
