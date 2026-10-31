import { describe, expect, it } from 'vitest';
import { skillSchema } from '../../scripts/schema';

/**
 * These tests prove the content gate is real.
 *
 * CONTENT_POLICY is only worth writing if it fails builds. A policy document
 * that depends on reviewers remembering it is a policy document that will be
 * forgotten on the day someone is shipping in a hurry.
 */

const validSkill = {
  id: 'water-boil',
  title: 'Boil water',
  category: 'water',
  difficulty: 'novice',
  riskTier: 'high',
  timeRequiredMin: 20,
  summary: 'Kills organisms. Removes nothing.',
  materials: [],
  steps: [{ n: 1, text: 'Bring to a rolling boil for one minute.' }],
  failureModes: [],
  doesNotDo: ['Does not remove chemical contamination.'],
  citations: [
    {
      source: 'CDC',
      title: 'Making Water Safe in an Emergency',
      published: '2024',
      basis: 'us-federal-work',
    },
  ],
  lastReviewed: '2026-10-29',
};

describe('skill schema gate', () => {
  it('accepts a well-formed skill', () => {
    expect(skillSchema.safeParse(validSkill).success).toBe(true);
  });

  it('rejects a skill that does not state what it does NOT do', () => {
    // CONTENT_POLICY §3.2. The filtration-vs-purification confusion is the
    // canonical case, and it is fatal.
    const result = skillSchema.safeParse({ ...validSkill, doesNotDo: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /does NOT do/.test(i.message))).toBe(true);
    }
  });

  it('rejects a skill with no doesNotDo field at all', () => {
    const { doesNotDo: _omitted, ...withoutLimits } = validSkill;
    expect(skillSchema.safeParse(withoutLimits).success).toBe(false);
  });

  it('rejects high-risk content with no citation', () => {
    // CONTENT_POLICY §3.1: the federal agency is the authority, we are the
    // translator. An uncited high-risk claim has no authority behind it.
    const result = skillSchema.safeParse({ ...validSkill, citations: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /citation/.test(i.message))).toBe(true);
    }
  });

  it('allows low-risk content without a citation', () => {
    const result = skillSchema.safeParse({
      ...validSkill,
      riskTier: 'low',
      citations: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects steps that are not consecutively numbered', () => {
    const result = skillSchema.safeParse({
      ...validSkill,
      steps: [
        { n: 1, text: 'First.' },
        { n: 3, text: 'Third, apparently.' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a citation basis that is not public domain', () => {
    const result = skillSchema.safeParse({
      ...validSkill,
      citations: [{ ...validSkill.citations[0], basis: 'licensed' }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Standing posture. CONTENT_POLICY §9.
// ---------------------------------------------------------------------------

const validPosture = {
  id: 'fortress-america',
  title: 'The Pentagon is hardening its own bases against the same failures',
  published: '2026-09-30',
  epistemicStatus: 'mixed',
  whatItIs: 'The Department of Defense announced a resilience programme.',
  reported: 'Press reporting puts the target at 90 days. No directive confirms it.',
  whatItMeansForYou:
    'Nothing is happening. It changes the horizon worth planning against, not what you do today.',
  horizonSignalDays: 90,
  citations: [
    {
      source: 'US Department of Defense',
      title: 'FORTRESS America announcement',
      published: '2026-09-30',
      basis: 'us-federal-work',
    },
  ],
  lastReviewed: '2026-10-29',
};

describe('posture schema gate', () => {
  it('accepts a well-formed, sourced posture note', async () => {
    const { postureSchema } = await import('../../scripts/schema');
    expect(postureSchema.safeParse(validPosture).success).toBe(true);
  });

  it('rejects an unofficial note that does not say which part is only reported', async () => {
    const { postureSchema } = await import('../../scripts/schema');
    const { reported: _omitted, ...withoutCaveat } = validPosture;
    const result = postureSchema.safeParse(withoutCaveat);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /only reported/.test(i.message))).toBe(true);
    }
  });

  it('rejects predictive language', async () => {
    // This is the content type most likely to drift into forecasting, and the
    // drift is gradual, so it is caught mechanically rather than at review.
    const { postureSchema } = await import('../../scripts/schema');
    for (const text of [
      'War is imminent.',
      'Conflict will reach the homeland.',
      'Brace for what follows.',
      'This is inevitable.',
    ]) {
      const result = postureSchema.safeParse({ ...validPosture, whatItMeansForYou: text });
      expect(result.success, `should have rejected: ${text}`).toBe(false);
    }
  });

  it('rejects an official claim with no primary citation', async () => {
    const { postureSchema } = await import('../../scripts/schema');
    expect(
      postureSchema.safeParse({ ...validPosture, epistemicStatus: 'official', citations: [] })
        .success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Economic indicators and offers. CONTENT_POLICY §7 and §10.
// ---------------------------------------------------------------------------

const validIndicator = {
  id: 'diesel-retail',
  name: 'Retail diesel',
  unit: 'USD/gal',
  current: 6.352,
  asOf: '2026-10-26',
  baseline: { label: '2026 year to date', value: 5.068 },
  epistemicStatus: 'mixed',
  whatItIs: 'The US average retail price of on-highway diesel.',
  reported: 'Relayed through commercial aggregators rather than read from EIA.',
  transmission: [
    { from: 'Crude oil', to: 'Diesel', lag: '2 to 4 weeks', note: 'Refiners price off crude.' },
  ],
  whatItMeansForYou: 'Your fuel bill moved first and has already moved.',
  wouldChangeThis: 'Diesel falling back toward the year-to-date average.',
  citations: [],
  lastReviewed: '2026-10-29',
};

describe('indicator schema gate', () => {
  it('accepts a well-formed indicator', async () => {
    const { indicatorSchema } = await import('../../scripts/schema');
    expect(indicatorSchema.safeParse(validIndicator).success).toBe(true);
  });

  it('rejects an indicator with no transmission chain', async () => {
    // A number with no stated mechanism is a number with no argument, and it
    // is indistinguishable from a scare.
    const { indicatorSchema } = await import('../../scripts/schema');
    const result = indicatorSchema.safeParse({ ...validIndicator, transmission: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an indicator with no exit condition', async () => {
    // Something that can only ever get worse is not a signal.
    const { indicatorSchema } = await import('../../scripts/schema');
    const { wouldChangeThis: _omitted, ...noExit } = validIndicator;
    expect(indicatorSchema.safeParse(noExit).success).toBe(false);
  });

  it('rejects forecasting and urging language', async () => {
    const { indicatorSchema } = await import('../../scripts/schema');
    for (const text of [
      'Prices will skyrocket.',
      'Stock up now before it is too late.',
      'A collapse is inevitable.',
    ]) {
      expect(
        indicatorSchema.safeParse({ ...validIndicator, whatItMeansForYou: text }).success,
        `should have rejected: ${text}`,
      ).toBe(false);
    }
  });
});

describe('offer schema gate', () => {
  const validOffer = {
    id: 'example-filter',
    itemId: 'filter-hollow-fibre',
    merchant: 'Example Merchant',
    url: 'https://example.com/offers/filter',
    affiliate: true,
    asOf: '2026-10-29',
  };

  it('accepts a well-formed offer', async () => {
    const { offerSchema } = await import('../../scripts/schema');
    expect(offerSchema.safeParse(validOffer).success).toBe(true);
  });

  it('requires affiliate status to be stated, never left to default', async () => {
    const { offerSchema } = await import('../../scripts/schema');
    const { affiliate: _omitted, ...undisclosed } = validOffer;
    expect(offerSchema.safeParse(undisclosed).success).toBe(false);
  });

  it('has no vocabulary for rank, priority or placement', async () => {
    // The §14 constraint at the schema level: commerce data literally cannot
    // express "put this first", so it cannot ask to be reordered.
    const { offerSchema } = await import('../../scripts/schema');
    const parsed = offerSchema.safeParse({
      ...validOffer,
      rank: 1,
      priority: 'top',
      sponsoredPlacement: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Object.keys(parsed.data).sort()).toEqual(
        ['affiliate', 'asOf', 'id', 'itemId', 'merchant', 'url'].sort(),
      );
    }
  });

  it('refuses a merchant price rather than quietly dropping it', async () => {
    // Offers ride inside the signed pack and sit on a phone for months.
    // Amazon's Associates agreement requires a displayed price to come from
    // their API and be under 24 hours old, which a signed offline artifact can
    // never be — so the field could only ever have been filled in wrongly.
    // Refused, not stripped: the mistake is worth an error message.
    const { offerSchema } = await import('../../scripts/schema');
    for (const priced of [
      { ...validOffer, priceCents: 2499 },
      { ...validOffer, priceCents: 0 },
      { ...validOffer, price: '24.99' },
    ]) {
      const parsed = offerSchema.safeParse(priced);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toMatch(/carry no price/);
      }
    }
  });

  it('still keeps asOf, which gates the link rather than a price', async () => {
    // asOf earns its place on its own: freshOffers drops an offer whose link
    // has not been checked in 45 days, and a dead link on a preparedness list
    // is worse than no link.
    const { offerSchema } = await import('../../scripts/schema');
    const { asOf: _omitted, ...undated } = validOffer;
    expect(offerSchema.safeParse(undated).success).toBe(false);
  });
});
