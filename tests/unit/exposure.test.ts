import { describe, expect, it } from 'vitest';
import {
  exposureHeadline,
  householdExposure,
  percentChange,
  readingAgeDays,
} from '@/features/exposure/exposure';
import type { Indicator } from '@/content/types';
import type { Profile } from '@/db/types';

const diesel: Indicator = {
  id: 'diesel-retail',
  name: 'Retail diesel',
  unit: 'USD/gal',
  current: 6.352,
  asOf: '2026-10-26',
  baseline: { label: '2026 year to date', value: 5.068 },
  epistemicStatus: 'mixed',
  whatItIs: 'The US average retail price of on-highway diesel.',
  reported: 'Relayed through aggregators.',
  transmission: [{ from: 'Crude', to: 'Diesel', lag: '2 to 4 weeks', note: 'n' }],
  whatItMeansForYou: 'Your fuel bill moved first.',
  wouldChangeThis: 'Diesel falling back toward the baseline.',
  citations: [],
  lastReviewed: '2026-10-29',
};

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'self',
  members: [{ id: 'm1', label: 'You', ageBand: 'adult' }],
  pets: 0,
  hazards: [],
  targetHorizonDays: 3,
  carryFraction: 0.2,
  ...over,
});

describe('indicator maths', () => {
  it('computes the change against the baseline', () => {
    expect(percentChange(diesel)).toBeCloseTo(25.33, 1);
  });

  it('reports the age of a reading rather than hiding it', () => {
    expect(readingAgeDays(diesel, new Date('2026-11-02T00:00:00Z'))).toBe(7);
  });

  it('does not divide by a zero baseline', () => {
    expect(percentChange({ ...diesel, baseline: { label: 'x', value: 0 } })).toBe(0);
  });
});

describe('household exposure', () => {
  it('computes nothing when the household has given us nothing', () => {
    // Guessing at someone's spending to produce a scary number would be the
    // opposite of the point.
    expect(householdExposure(diesel, profile()).needsInput).toBe(true);
  });

  it('applies the change directly to fuel spend', () => {
    const e = householdExposure(diesel, profile({ monthlyFuelSpendCents: 20_000 }));
    // $200/month at +25.33% is about $50.66.
    expect(e.totalLowCents).toBeGreaterThan(5_000);
    expect(e.totalLowCents).toBeLessThan(5_200);
  });

  it('passes fuel through to groceries only via the freight share', () => {
    const e = householdExposure(diesel, profile({ monthlyGrocerySpendCents: 60_000 }));
    const line = e.lines[0]!;
    // Freight is 3-8% of shelf price, so $600 of groceries moves by about
    // $4.50-$12 — not by 25%. This is the number that defuses the headline.
    expect(line.lowCents).toBeGreaterThan(400);
    expect(line.highCents).toBeLessThan(1_300);
    expect(line.highCents).toBeLessThan(60_000 * 0.2533 * 0.1);
  });

  it('returns a range for groceries and a point for fuel', () => {
    const e = householdExposure(
      diesel,
      profile({ monthlyFuelSpendCents: 20_000, monthlyGrocerySpendCents: 60_000 }),
    );
    const fuel = e.lines.find((l) => l.label.startsWith('Fuel'))!;
    const grocery = e.lines.find((l) => l.label.startsWith('Groceries'))!;
    expect(fuel.lowCents).toBe(fuel.highCents);
    expect(grocery.lowCents).toBeLessThan(grocery.highCents);
  });

  it('names fuel as the dominant cost rather than quoting a scary total', () => {
    const e = householdExposure(
      diesel,
      profile({ monthlyFuelSpendCents: 20_000, monthlyGrocerySpendCents: 60_000 }),
    );
    expect(exposureHeadline(e)).toMatch(/almost all of this is fuel/i);
  });

  it('offers no headline when one line does not dominate', () => {
    // $40 of fuel against $600 of groceries: roughly $10 vs $12 at the high
    // end, so neither line is the story and the app should not pretend one is.
    const e = householdExposure(
      diesel,
      profile({ monthlyFuelSpendCents: 4_000, monthlyGrocerySpendCents: 60_000 }),
    );
    expect(exposureHeadline(e)).toBeUndefined();
  });

  it('falls as well as rises — an indicator below baseline costs nothing extra', () => {
    // The property that makes this a signal rather than a ratchet.
    const fallen: Indicator = { ...diesel, current: 4.0 };
    const e = householdExposure(fallen, profile({ monthlyFuelSpendCents: 20_000 }));
    expect(e.changePct).toBeLessThan(0);
    expect(e.totalLowCents).toBeLessThan(0);
  });
});
