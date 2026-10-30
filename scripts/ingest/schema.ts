import { z } from 'zod';
import { postureSchema } from '../schema.js';

/**
 * The published digest, validated at runtime.
 *
 * Deliberately a zod schema in build-time code rather than an import of the
 * app's TypeScript types. Two reasons, and the second is the real one:
 *
 *   The app project and the scripts project are kept apart on purpose, so the
 *   zod schemas never reach the client bundle.
 *
 *   This data comes from six external APIs that can change shape without
 *   telling anyone. Compile-time types say what we hoped for; this says what
 *   actually arrived. A digest that fails validation is never signed, so a
 *   source that starts returning something unexpected costs a stale digest
 *   rather than a broken one.
 */

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'must be a parseable date',
});

export const signalSchema = z.object({
  source: z.enum(['nws', 'usgs', 'wildfire-air', 'openfema', 'swpc']),
  sourceName: z.string().min(1),
  level: z.enum(['quiet', 'elevated', 'active']),
  headline: z.string().min(1),
  meansForYou: z.string().min(1),
  // §4.4 makes the link mandatory, and https specifically: a claim the reader
  // cannot check is one that is asking to be trusted.
  url: z.string().url().startsWith('https://'),
  observedAt: isoDate,
});

export const briefSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['unrest', 'conflict', 'disaster', 'weather', 'infrastructure']),
  headline: z.string().min(1),
  whatItMeansForYou: z.string().min(1),
  url: z.string().url().startsWith('https://'),
  source: z.string().min(1),
  published: isoDate,
  epistemicStatus: z.enum(['official', 'press-reported', 'mixed']),
  where: z.string().optional(),
});

export const snapshotSchema = z.object({
  version: z.literal(1),
  provenance: z.enum(['live', 'sample']),
  region: z.string().min(1),
  regionLabel: z.string().min(1),
  publishedAt: isoDate,
  signals: z.array(signalSchema),
  brief: z.array(briefSchema).optional(),
  /**
   * Standing posture the publisher has fresher than the pack shipped with.
   * Validated against the pack's own posture schema rather than a second copy
   * of it: a note published here is read by the same client code that reads
   * the pack's, so it has to meet the same bar — including the refinement
   * that forbids predicting.
   */
  posture: z.array(postureSchema).optional(),
  unreachable: z.array(z.string()).optional(),
  /** The signal sources actually tried, which is the confidence denominator. */
  attempted: z.array(z.enum(['nws', 'usgs', 'wildfire-air', 'openfema', 'swpc'])).optional(),
});

export type Signal = z.infer<typeof signalSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type Posture = z.infer<typeof postureSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
