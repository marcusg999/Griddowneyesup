import { describe, expect, it } from 'vitest';
import { balance, fit } from '@/ui/Stamp';

/**
 * The stamp is the one thing in this app that must be impossible to misread,
 * so the layout that keeps it inside its own die is worth pinning.
 *
 * The widths here are the estimate the component uses, not the browser's. The
 * offline suite measures the real font; these fix the wrapping decisions.
 */
const FIT_WIDTH = 360;
const widestRow = (line: string): number => {
  const { rows, fontSize } = fit(line);
  const chars = Math.max(...rows.map((r) => r.length));
  return chars * (fontSize * 0.75 + 2);
};

describe('the stamp fits its die', () => {
  // Every stampLine in the library at the time this was written, including
  // the two that were being clipped on a phone and the two that were already
  // escaping the viewBox unnoticed.
  const LINES = [
    'Needs other nodes to exist',
    'Listening needs no licence',
    'Does not remove viruses',
    'Contains, does not treat',
    'Boiling spares spores',
    'Weak on crypto',
    'Never taste it',
    'Two different doses',
    'Confident and wrong',
    '20 feet, no exceptions',
    'Removes nothing',
  ];

  it('keeps every line inside the die', () => {
    for (const line of LINES) {
      expect(widestRow(line), line).toBeLessThanOrEqual(FIT_WIDTH);
    }
  });

  it('balances by width, not by word count', () => {
    // The bug. Five words split evenly is "Needs other nodes" / "to exist",
    // which is an even split of the WORDS and a wildly uneven split of the
    // width — and the long row ran off both ends of the stamp.
    const rows = balance('Needs other nodes to exist', 2);
    const spread = Math.max(...rows.map((r) => r.length)) - Math.min(...rows.map((r) => r.length));
    expect(spread).toBeLessThan('Needs other nodes'.length - 'to exist'.length);
  });

  it('adds a row rather than overflowing, and shrinks as it does', () => {
    const short = fit('Removes nothing');
    const long = fit('Needs other nodes to exist');
    expect(long.rows.length).toBeGreaterThan(short.rows.length);
    expect(long.fontSize).toBeLessThan(short.fontSize);
  });

  it('gives a short line the big single-row treatment', () => {
    // The stamp should not quietly shrink everything to be safe. A line that
    // fits large stays large.
    const one = fit('No fire');
    expect(one.rows).toEqual(['No fire']);
    expect(one.fontSize).toBe(54);
  });

  it('has a baseline for every row it returns', () => {
    for (const line of [...LINES, 'One', 'Two words']) {
      const { rows, baselines } = fit(line);
      expect(baselines.length).toBeGreaterThanOrEqual(rows.length);
    }
  });

  it('never loses a word', () => {
    for (const line of LINES) {
      expect(fit(line).rows.join(' ')).toBe(line);
    }
  });

  it('survives a single word too long to wrap', () => {
    // Nothing left to split, so the component squeezes it instead. The
    // layout still has to come back with something renderable.
    const { rows, fontSize } = fit('Supercalifragilisticexpialidocious');
    expect(rows).toHaveLength(1);
    expect(fontSize).toBeGreaterThan(0);
  });
});
