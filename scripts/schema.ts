import { z } from 'zod';

/**
 * Build-time validation schemas.
 *
 * Mirrors `src/content/types.ts`. Kept separate so zod never enters the client
 * bundle — the §8 performance budget does not have room for a validator the
 * user never benefits from, because content is validated before it ships.
 *
 * These schemas are also where CONTENT_POLICY §3 stops being a document and
 * becomes a build failure.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const citationSchema = z.object({
  source: z.string().min(1),
  title: z.string().min(1),
  published: z.string().min(1),
  url: z.string().url().optional(),
  basis: z.enum(['us-federal-work', 'pre-1929-publication']),
});

export const riskTierSchema = z.enum(['low', 'medium', 'high']);

export const skillSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    category: z.enum([
      'water',
      'food',
      'sanitation',
      'heat-shelter',
      'power',
      'medical',
      'comms-navigation',
      'psychological',
    ]),
    difficulty: z.enum(['novice', 'practiced', 'experienced']),
    riskTier: riskTierSchema,
    timeRequiredMin: z.number().int().positive(),
    summary: z.string().min(1),
    materials: z.array(z.string()),
    steps: z
      .array(
        z.object({
          n: z.number().int().positive(),
          text: z.string().min(1),
          caution: z.string().min(1).optional(),
        }),
      )
      .min(1),
    failureModes: z.array(
      z.object({
        symptom: z.string().min(1),
        cause: z.string().min(1),
        remedy: z.string().min(1),
      }),
    ),

    /**
     * CONTENT_POLICY §3.2. Required on every skill, not just water ones.
     * A skill that cannot articulate its own limits is not understood well
     * enough to publish.
     */
    doesNotDo: z.array(z.string().min(1)).min(1, 'every skill must state what it does NOT do'),

    // Short enough to stamp and still be read at a glance.
    stampLine: z.string().min(1).max(28).optional(),

    citations: z.array(citationSchema),
    lastReviewed: isoDate,
    hazards: z
      .array(
        z.enum([
          'nuclear-radiological',
          'flood',
          'hurricane',
          'wildfire',
          'earthquake',
          'winter-storm',
          'grid-down',
          'civil-disruption',
        ]),
      )
      .optional(),
  })
  // CONTENT_POLICY §3.1 — high-risk content must be traceable to a source.
  .refine((s) => s.riskTier !== 'high' || s.citations.length > 0, {
    message: 'riskTier "high" requires at least one citation',
    path: ['citations'],
  })
  // Steps must be numbered 1..n with no gaps, so printed output is unambiguous.
  .refine((s) => s.steps.every((step, i) => step.n === i + 1), {
    message: 'steps must be numbered consecutively from 1',
    path: ['steps'],
  });

/**
 * Standing posture. CONTENT_POLICY §9.
 *
 * Every claim carries its epistemic status, and any note whose status is not
 * fully official must say which part is merely reported. The schema enforces
 * that rather than trusting an author to remember it.
 */
export const postureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    published: isoDate,
    epistemicStatus: z.enum(['official', 'press-reported', 'mixed']),
    whatItIs: z.string().min(1),
    reported: z.string().min(1).optional(),
    whatItMeansForYou: z.string().min(1),
    horizonSignalDays: z.number().int().positive().optional(),
    citations: z.array(citationSchema),
    pressCitations: z
      .array(
        z.object({
          source: z.string().min(1),
          title: z.string().min(1),
          published: z.string().min(1),
          url: z.string().url().optional(),
        }),
      )
      .optional(),
    lastReviewed: isoDate,
  })
  .refine((n) => n.epistemicStatus === 'official' || (n.reported?.length ?? 0) > 0, {
    message:
      'a posture note that is not fully official must state which part is only reported',
    path: ['reported'],
  })
  .refine((n) => n.epistemicStatus === 'press-reported' || n.citations.length > 0, {
    message: 'a posture note claiming official status needs a primary citation',
    path: ['citations'],
  })
  // §4.1: never editorialize, never predict. Caught mechanically because this
  // is the content type most likely to drift into forecasting.
  .refine(
    (n) =>
      !/\b(will|imminent|inevitable|coming war|any day now|brace|prepare now)\b/i.test(
        `${n.title} ${n.whatItIs} ${n.whatItMeansForYou}`,
      ),
    {
      message: 'posture notes must not predict or urge; state what happened and what it means',
      path: ['whatItMeansForYou'],
    },
  );

export const catalogItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  spec: z.string().min(1),
  category: z.enum([
    'water',
    'food',
    'heat-light',
    'power',
    'medical',
    'sanitation',
    'tools',
    'comms',
    'navigation',
    'documents',
    'cash',
    'barter',
    'shelter',
    'clothing',
    'defense-adjacent',
  ]),
  unit: z.string().min(1),
  weightG: z.number().nonnegative(),
  volumeMl: z.number().nonnegative().optional(),
  typicalCostCents: z.number().nonnegative().optional(),
  costTier: z.enum(['tier-50', 'tier-200', 'tier-500', 'beyond']),
  valuePerDollar: z.number().min(0).max(100),
  provides: z
    .array(
      z.object({
        resource: z.enum([
          'water-litres',
          'calories-kcal',
          'heat-hours',
          'power-wh',
          'sanitation-uses',
        ]),
        perUnit: z.number().positive(),
      }),
    )
    .optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const kitSchema = z.object({
  id: z.enum(['edc', 'ghb', 'bedside', 'home', 'bob', 'bov', 'inch']),
  name: z.string().min(1),
  scenario: z.string().min(1),
  horizon: z.string().min(1),
  carriedHow: z.string().min(1),
  carryMode: z.enum(['person', 'vehicle', 'back-on-foot', 'static']),
  rung: z.number().int().positive(),
  weightBudgeted: z.boolean(),
  baseItems: z.array(z.string()).min(1),
  criticalItems: z.array(z.string()),
});

const overlaySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  addsItems: z.array(z.string()).min(1),
  criticalItems: z.array(z.string()),
});

export const overlaysSchema = z.object({
  hazard: z.array(overlaySchema),
  dependent: z.array(overlaySchema),
});

export type ValidatedSkill = z.infer<typeof skillSchema>;
export type ValidatedItem = z.infer<typeof catalogItemSchema>;
export type ValidatedKit = z.infer<typeof kitSchema>;

/**
 * Economic indicators. CONTENT_POLICY §10.
 *
 * Same discipline as posture notes — epistemic status, no prediction — plus
 * two extra requirements that make this a signal rather than a scare: a
 * transmission chain the reader can inspect link by link, and an explicit
 * statement of what would end it.
 */
export const indicatorSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    unit: z.string().min(1),
    current: z.number(),
    asOf: isoDate,
    baseline: z.object({ label: z.string().min(1), value: z.number() }),
    epistemicStatus: z.enum(['official', 'press-reported', 'mixed']),
    whatItIs: z.string().min(1),
    reported: z.string().min(1).optional(),
    transmission: z
      .array(
        z.object({
          from: z.string().min(1),
          to: z.string().min(1),
          lag: z.string().min(1),
          note: z.string().min(1),
        }),
      )
      .min(1, 'an indicator without a transmission chain is a number with no argument'),
    whatItMeansForYou: z.string().min(1),
    wouldChangeThis: z
      .string()
      .min(1, 'an indicator with no stated exit condition is a scare, not a signal'),
    citations: z.array(citationSchema),
    pressCitations: z
      .array(
        z.object({
          source: z.string().min(1),
          title: z.string().min(1),
          published: z.string().min(1),
          url: z.string().url().optional(),
        }),
      )
      .optional(),
    lastReviewed: isoDate,
  })
  .refine((n) => n.epistemicStatus === 'official' || (n.reported?.length ?? 0) > 0, {
    message: 'an indicator that is not fully official must state which part is only reported',
    path: ['reported'],
  })
  .refine(
    (n) =>
      !/\b(will|imminent|inevitable|coming war|any day now|brace|stock up now|prepare now|skyrocket|collapse)\b/i.test(
        `${n.whatItIs} ${n.whatItMeansForYou}`,
      ),
    {
      message: 'indicators state what is measured and how it propagates; they do not forecast',
      path: ['whatItMeansForYou'],
    },
  );

/**
 * Offers. §14 / CONTENT_POLICY §7.
 *
 * Note what is NOT here: any ordering, ranking, score or priority field. The
 * schema cannot express "put this first", so commerce data has no vocabulary
 * for influencing recommendation order.
 */
export const offerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  itemId: z.string().regex(/^[a-z0-9-]+$/),
  merchant: z.string().min(1),
  url: z.string().url(),
  affiliate: z.boolean(),
  priceCents: z.number().int().nonnegative().optional(),
  asOf: isoDate,
});
