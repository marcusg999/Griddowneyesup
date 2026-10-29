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
