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
