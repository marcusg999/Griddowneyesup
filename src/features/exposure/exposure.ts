import type { Indicator } from '@/content/types';
import type { Profile } from '@/db/types';

/**
 * Household economic exposure. §4.1 supply-chain module.
 *
 * Arithmetic on the household's own numbers against an observed, cited
 * indicator. Not a forecast: every figure here is "what the current reading
 * costs you per month compared with the baseline", which is subtraction.
 *
 * Results are ranges rather than point estimates, because the pass-through
 * shares are genuinely uncertain and one confident number would be exactly
 * the false precision §4.1 rules out.
 */

/**
 * Freight as a share of a grocery item's retail price.
 *
 * Low for light, high-value goods; high for heavy, cheap ones. That spread is
 * why the honest answer to "will fuel prices double my grocery bill" is no.
 */
const FREIGHT_SHARE = { low: 0.03, high: 0.08 } as const;

export interface ExposureLine {
  readonly label: string;
  /** Extra cost per month in cents, current reading vs baseline. */
  readonly lowCents: number;
  readonly highCents: number;
  /** How it was computed, in one sentence the reader can check. */
  readonly basis: string;
  /** Where it is approximate, stated rather than buried. */
  readonly caveat?: string;
}

export interface Exposure {
  readonly indicatorId: string;
  readonly changePct: number;
  readonly lines: readonly ExposureLine[];
  readonly totalLowCents: number;
  readonly totalHighCents: number;
  /** True when the household has given us nothing to compute from. */
  readonly needsInput: boolean;
}

export function percentChange(indicator: Indicator): number {
  const base = indicator.baseline.value;
  if (base === 0) return 0;
  return ((indicator.current - base) / base) * 100;
}

/** Days since the reading. Staleness is shown, never hidden. */
export function readingAgeDays(indicator: Indicator, now: Date = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(indicator.asOf).getTime()) / 86_400_000),
  );
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;

export function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function householdExposure(indicator: Indicator, profile: Profile): Exposure {
  const changePct = percentChange(indicator);
  const factor = changePct / 100;
  const lines: ExposureLine[] = [];

  const fuel = profile.monthlyFuelSpendCents ?? 0;
  const grocery = profile.monthlyGrocerySpendCents ?? 0;

  if (fuel > 0) {
    const delta = Math.round(fuel * factor);
    lines.push({
      label: 'Fuel you buy directly',
      lowCents: delta,
      highCents: delta,
      basis: `Your stated ${money(fuel)} a month, moved by ${changePct.toFixed(1)}%.`,
      caveat:
        'Assumes the fuel you buy moved like diesel did. Petrol and diesel usually move together and sometimes do not.',
    });
  }

  if (grocery > 0) {
    const low = Math.round(grocery * FREIGHT_SHARE.low * factor);
    const high = Math.round(grocery * FREIGHT_SHARE.high * factor);
    lines.push({
      label: 'Groceries, through freight',
      lowCents: low,
      highCents: high,
      basis: `Freight is ${pct(FREIGHT_SHARE.low)}–${pct(FREIGHT_SHARE.high)} of a grocery item's shelf price, and that share moved by ${changePct.toFixed(1)}%.`,
      caveat:
        'The high end applies to heavy, cheap goods — bottled water, canned food, bulk grain. Light, high-value goods barely move.',
    });
  }

  return {
    indicatorId: indicator.id,
    changePct,
    lines,
    totalLowCents: lines.reduce((n, l) => n + l.lowCents, 0),
    totalHighCents: lines.reduce((n, l) => n + l.highCents, 0),
    needsInput: lines.length === 0,
  };
}

/**
 * The honest headline.
 *
 * Names the dominant line rather than the total, because which bill actually
 * moved is the useful fact. "Your costs rose by X" is alarming and not
 * actionable; "almost all of it is fuel, groceries barely moved" is both
 * calmer and more true.
 */
export function exposureHeadline(exposure: Exposure): string | undefined {
  if (exposure.needsInput || exposure.lines.length < 2) return undefined;
  const dominant = [...exposure.lines].sort((a, b) => b.highCents - a.highCents)[0];
  if (!dominant || exposure.totalHighCents <= 0) return undefined;
  const share = dominant.highCents / exposure.totalHighCents;
  if (share > 0.7) {
    return `Almost all of this is ${dominant.label.toLowerCase()}. The rest barely moved.`;
  }
  return undefined;
}
