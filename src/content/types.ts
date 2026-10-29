/**
 * Core domain model.
 *
 * Pure types only — no runtime dependency, nothing shipped to the bundle.
 * Build-time validation lives in `scripts/schema.ts`, which mirrors this file.
 * If you change a type here, change the zod schema there; `content:validate`
 * will catch you if you forget.
 */

// ---------------------------------------------------------------------------
// Sensitivity classification (D05 / ARCHITECTURE §5)
// ---------------------------------------------------------------------------

/**
 * Every persisted field declares a sensitivity class at declaration, not at
 * usage. `sensitive` data never leaves the device in v1 — no sync, no server
 * row, no exception.
 */
export type Sensitivity = 'public' | 'local' | 'sensitive';

// ---------------------------------------------------------------------------
// Citations and review (D09 / CONTENT_POLICY §3)
// ---------------------------------------------------------------------------

/** Public-domain basis. We ship nothing that needs a licence. */
export type PublicDomainBasis =
  | 'us-federal-work' // 17 USC §105
  | 'pre-1929-publication';

export interface Citation {
  /** Publishing body, e.g. "FEMA", "CDC", "EPA", "US Army". */
  readonly source: string;
  readonly title: string;
  /** ISO 8601 date or year, as published. */
  readonly published: string;
  readonly url?: string;
  readonly basis: PublicDomainBasis;
}

/**
 * How badly a mistake here hurts someone.
 *
 * `high` means failure can kill or permanently injure. High-risk content is
 * written flat and plain with no voice (CONTENT_POLICY §4.2), must carry a
 * citation, and is flagged for professional review.
 */
export type RiskTier = 'low' | 'medium' | 'high';

// ---------------------------------------------------------------------------
// Skills (§4.3)
// ---------------------------------------------------------------------------

export type SkillCategory =
  | 'water'
  | 'food'
  | 'sanitation'
  | 'heat-shelter'
  | 'power'
  | 'medical'
  | 'comms-navigation'
  | 'psychological';

export type Difficulty = 'novice' | 'practiced' | 'experienced';

export interface SkillStep {
  readonly n: number;
  readonly text: string;
  /** Rendered as a distinct warning block, never inline prose. */
  readonly caution?: string;
}

export interface FailureMode {
  /** What goes wrong. */
  readonly symptom: string;
  /** Why it goes wrong. */
  readonly cause: string;
  /** What to do about it. */
  readonly remedy: string;
}

export interface Skill {
  readonly id: string;
  readonly title: string;
  readonly category: SkillCategory;
  readonly difficulty: Difficulty;
  readonly riskTier: RiskTier;
  /** Minutes. Honest estimate for someone doing it the first time. */
  readonly timeRequiredMin: number;

  /** One-paragraph plain summary. This is what search results show. */
  readonly summary: string;

  /** Item catalog ids. Cross-links the skill to the supply system. */
  readonly materials: readonly string[];

  readonly steps: readonly SkillStep[];
  readonly failureModes: readonly FailureMode[];

  /**
   * MANDATORY on every skill. CONTENT_POLICY §3.2.
   *
   * What this technique does NOT do. The water case is the template:
   * a sand-and-charcoal column improves clarity, sediment and taste — it does
   * not make water microbiologically safe, and most filters do not remove
   * viruses. A skill that cannot articulate its own limits is not understood
   * well enough to publish.
   */
  readonly doesNotDo: readonly string[];

  /**
   * The single most important limitation, compressed to a few words — what
   * gets stamped across the page. Content, not presentation: this is the line
   * someone reads at 3am instead of the full list.
   */
  readonly stampLine?: string;

  readonly citations: readonly Citation[];
  /** ISO date. Staleness surfaces in the admin view; >18mo fails the build. */
  readonly lastReviewed: string;

  /** Hazards this skill is especially relevant to. Drives surfacing order. */
  readonly hazards?: readonly HazardId[];
}

// ---------------------------------------------------------------------------
// Hazards and overlays (§4.2)
// ---------------------------------------------------------------------------

export type HazardId =
  | 'nuclear-radiological'
  | 'flood'
  | 'hurricane'
  | 'wildfire'
  | 'earthquake'
  | 'winter-storm'
  | 'grid-down'
  | 'civil-disruption';

export type DependentId =
  | 'infant'
  | 'child'
  | 'elder'
  | 'mobility'
  | 'pet';

// ---------------------------------------------------------------------------
// The kit ladder (§4.2) — the core schema
// ---------------------------------------------------------------------------

/**
 * Preparedness is a ladder of kits differentiated by distance from home,
 * duration, and carry weight. Ordered by onboarding sequence, not by size:
 * nobody starts with an INCH bag.
 */
export type KitId =
  | 'edc' // Everyday Carry — on your person. Minutes to hours.
  | 'ghb' // Get Home Bag — stranded away. 12-24h, one leg on foot.
  | 'bedside' // Immediate-grab. Woken by a 3am event.
  | 'home' // Shelter in place. Weeks to months.
  | 'bob' // Bug Out Bag — evacuating on foot. 72h.
  | 'bov' // Bug Out Vehicle — evacuating with a vehicle. Days.
  | 'inch'; // I'm Never Coming Home. Indefinite.

export type CarryMode = 'person' | 'vehicle' | 'back-on-foot' | 'static';

export interface KitDefinition {
  readonly id: KitId;
  readonly name: string;
  readonly scenario: string;
  readonly horizon: string;
  readonly carriedHow: string;
  readonly carryMode: CarryMode;
  /** Position in the onboarding ladder. Lower unlocks first. */
  readonly rung: number;
  /**
   * Whether a carry-weight budget applies. Static kits have no weight limit;
   * a BOB you cannot carry a mile is not a BOB.
   */
  readonly weightBudgeted: boolean;
  /** Item catalog ids that constitute the base kit. */
  readonly baseItems: readonly string[];
  /** Subset of baseItems that must be present regardless of 80% threshold. */
  readonly criticalItems: readonly string[];
}

export interface HazardOverlay {
  readonly id: HazardId;
  readonly name: string;
  /** Additional items layered onto any base kit. */
  readonly addsItems: readonly string[];
  readonly criticalItems: readonly string[];
}

export interface DependentOverlay {
  readonly id: DependentId;
  readonly name: string;
  readonly addsItems: readonly string[];
  readonly criticalItems: readonly string[];
}

// ---------------------------------------------------------------------------
// Items and resources
// ---------------------------------------------------------------------------

export type ItemCategory =
  | 'water'
  | 'food'
  | 'heat-light'
  | 'power'
  | 'medical'
  | 'sanitation'
  | 'tools'
  | 'comms'
  | 'navigation'
  | 'documents'
  | 'cash'
  | 'barter'
  | 'shelter'
  | 'clothing'
  | 'defense-adjacent';

/**
 * What a resource is measured in for gap analysis.
 *
 * Coverage is expressed in DAYS, derived by dividing stock by the household's
 * computed daily need. Days is a physical quantity the user can verify. It is
 * the app's score (D16) precisely because it is not a point total.
 */
export type ResourceKind =
  | 'water-litres'
  | 'calories-kcal'
  | 'heat-hours'
  | 'power-wh'
  | 'sanitation-uses';

export interface ResourceContribution {
  readonly resource: ResourceKind;
  /** Amount contributed per unit of this item. */
  readonly perUnit: number;
}

/**
 * Cost-staged acquisition (§4.2). The list splits into tiers so a broke user
 * gets a real path instead of a shopping fantasy. Ordered by marginal survival
 * value per dollar — never by commerce (D14).
 */
export type CostTier = 'tier-50' | 'tier-200' | 'tier-500' | 'beyond';

export interface CatalogItem {
  readonly id: string;
  readonly name: string;
  /**
   * Specification, never a brand or SKU (D14). "0.1-micron hollow-fibre
   * filter", not a product link.
   */
  readonly spec: string;
  readonly category: ItemCategory;
  readonly unit: string;

  /** Grams per unit. Drives weight budgeting — the killer feature. */
  readonly weightG: number;
  /** Millilitres per unit. Drives pack-volume warnings. */
  readonly volumeMl?: number;
  /** Typical cost in cents per unit. Drives the acquisition tiers. */
  readonly typicalCostCents?: number;
  readonly costTier: CostTier;

  /**
   * Marginal survival value per dollar, 0-100. The sole ordering key for
   * recommendations. Commerce data may only ever be joined AFTER ordering is
   * computed (D14 / CONTENT_POLICY §7).
   */
  readonly valuePerDollar: number;

  readonly provides?: readonly ResourceContribution[];
  /** Typical shelf life in days, where applicable. Drives the rotation queue. */
  readonly shelfLifeDays?: number;
  readonly notes?: string;
}

// ---------------------------------------------------------------------------
// Content pack (ARCHITECTURE §6)
// ---------------------------------------------------------------------------

export interface ContentPackEntry {
  readonly path: string;
  /** SHA-256, hex. Verified before the pack is activated. */
  readonly sha256: string;
  readonly bytes: number;
}

export interface ContentPackManifest {
  readonly version: string;
  readonly locale: string;
  readonly builtAt: string;
  readonly entries: readonly ContentPackEntry[];
  readonly counts: {
    readonly skills: number;
    readonly items: number;
    readonly kits: number;
  };
}

export interface ContentPack {
  readonly manifest: ContentPackManifest;
  readonly skills: readonly Skill[];
  readonly items: readonly CatalogItem[];
  readonly kits: readonly KitDefinition[];
  readonly hazardOverlays: readonly HazardOverlay[];
  readonly dependentOverlays: readonly DependentOverlay[];
}
