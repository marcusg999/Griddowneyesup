import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrast is a release gate here, not a review note.
 *
 * Brief §8: accessibility is a survival feature in this product. Someone may
 * be reading this at night, on a cracked screen, with adrenaline. A token that
 * silently drifts below AA is a defect, so the tokens are measured rather than
 * eyeballed.
 */

const css = readFileSync(new URL('../../src/ui/theme.css', import.meta.url), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`\\s--${name}:\\s*(#[0-9a-f]{6});`, 'i'));
  if (!match?.[1]) throw new Error(`token --${name} not found`);
  return match[1];
}

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(n.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('palette contrast', () => {
  const paper = () => token('paper');
  const bg = () => token('bg');

  it.each([
    ['ink', 4.5],
    ['ink-dim', 4.5],
    ['ink-faint', 4.5],
    ['acid', 4.5],
    ['acid-deep', 4.5],
    ['stamp', 4.5],
    ['warn', 4.5],
  ])('--%s clears AA on paper', (name, min) => {
    expect(contrast(token(name), paper())).toBeGreaterThanOrEqual(min);
  });

  it('the acid accent clears AAA on the page background', () => {
    // It carries the headline figures, so it earns the stricter bar.
    expect(contrast(token('acid'), bg())).toBeGreaterThanOrEqual(7);
  });

  it('body ink clears AAA', () => {
    expect(contrast(token('ink'), bg())).toBeGreaterThanOrEqual(7);
  });
});
