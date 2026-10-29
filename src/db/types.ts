import type {
  DependentId,
  HazardId,
  KitId,
  ResourceKind,
  Sensitivity,
} from '@/content/types';

/**
 * Locally persisted user state.
 *
 * Each store declares the sensitivity class of its records, which is what the
 * cipher boundary routes on (ARCHITECTURE §5).
 */

export const STORE_SENSITIVITY: Record<string, Sensitivity> = {
  profile: 'sensitive', // household ages, medical needs
  inventory: 'local',
  kitState: 'local',
  plan: 'sensitive', // rally points, duress codes
  contacts: 'sensitive',
  achievements: 'local',
  skillProgress: 'local',
  readinessSnapshots: 'local',
  drills: 'local',
  content: 'public',
  meta: 'local',
};

export interface HouseholdMember {
  readonly id: string;
  readonly label: string;
  /** Band rather than exact age: enough for calorie and water modelling. */
  readonly ageBand: 'infant' | 'child' | 'adult' | 'elder';
  readonly dependents?: readonly DependentId[];
}

export interface Profile {
  readonly id: 'self';
  readonly members: readonly HouseholdMember[];
  readonly pets: number;
  /** FIPS code. Joins to the FEMA National Risk Index baseline. */
  readonly countyFips?: string;
  readonly dwelling?: 'apartment' | 'house' | 'mobile' | 'other';
  readonly urbanRural?: 'urban' | 'suburban' | 'rural';
  readonly hazards: readonly HazardId[];
  /** Target horizon in days: 3 / 14 / 30 / 90 / 365. */
  readonly targetHorizonDays: number;
  /** Kilograms. Used for the carry-weight budget. */
  readonly bodyweightKg?: number;
  /** Fraction of bodyweight treated as the carry ceiling. Default 0.20. */
  readonly carryFraction: number;
}

export interface InventoryRecord {
  readonly id: string;
  readonly itemId: string;
  readonly quantity: number;
  /** ISO date. Drives the rotation queue. */
  readonly expiresOn?: string;
  readonly storedAt?: string;
  readonly costCents?: number;
  /**
   * An item belongs to many kits at once. One record, many memberships — the
   * app computes per-kit completeness without the user re-entering anything.
   */
  readonly kits: readonly KitId[];
  readonly addedAt: string;
  readonly notes?: string;
}

export interface Achievement {
  readonly slug: string;
  readonly earnedAt: string;
  /** What proved it: a drill id, an export, a logged carry test. */
  readonly evidence?: string;
}

export interface SkillProgress {
  readonly skillId: string;
  readonly readAt?: string;
  /** Only practiced counts toward progression. Reading is not a filter. */
  readonly practicedAt?: string;
  readonly notes?: string;
}

/**
 * A point on the coverage curve. The retention engine: it lets the app show a
 * curve of real numbers over time rather than a point score.
 */
export interface ReadinessSnapshot {
  readonly date: string;
  readonly daysByResource: Partial<Record<ResourceKind, number>>;
  readonly tier: string;
  readonly rungsComplete: number;
}

/** v1.1. Schema lands now so the store does not need migrating later. */
export interface DrillLog {
  readonly id: string;
  readonly type: 'water-shutoff' | 'blackout' | 'grab-bag' | 'rally-point' | 'dead-phone';
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationS?: number;
  readonly result: 'passed' | 'failed' | 'abandoned';
  readonly notes?: string;
  /** Gaps discovered, as catalog item ids. These flow into the shopping list. */
  readonly gapsFound: readonly string[];
}
