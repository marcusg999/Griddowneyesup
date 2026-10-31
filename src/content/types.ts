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
// Standing posture (§4.1 baseline risk)
// ---------------------------------------------------------------------------

/**
 * How well established a claim is.
 *
 * Carried explicitly because §4.1 requires showing confidence rather than
 * projecting it. "Press reporting on internal documents" and "published
 * directive" are different things and the UI must not flatten them.
 */
export type EpistemicStatus =
  | 'official' // traceable to a published government source
  | 'press-reported' // reported by media, no primary source released
  | 'mixed'; // an official announcement plus unverified reported detail

/**
 * A standing fact about the world that informs what horizon is worth planning
 * for. NOT a live signal, and explicitly NOT an input to the readiness state
 * (see CONTENT_POLICY §9) — posture is baseline context, measured in months,
 * and a readiness state driven by policy news would never come back down.
 */
export interface PostureNote {
  readonly id: string;
  readonly title: string;
  /** ISO date of the underlying event. */
  readonly published: string;
  readonly epistemicStatus: EpistemicStatus;
  /** What was actually announced. Flat, sourced, no interpretation. */
  readonly whatItIs: string;
  /** Detail that is reported but not confirmed. Rendered as such. */
  readonly reported?: string;
  /** Plain-language consequence for a household. Never a call to alarm. */
  readonly whatItMeansForYou: string;
  /**
   * A horizon, in days, that this posture suggests is worth considering.
   * It is shown next to the user's own target. It never changes it, and never
   * changes the readiness state.
   */
  readonly horizonSignalDays?: number;
  readonly citations: readonly Citation[];
  /** Press sources, kept separate so they are never mistaken for primary. */
  readonly pressCitations?: readonly {
    readonly source: string;
    readonly title: string;
    readonly published: string;
    readonly url?: string;
  }[];
  readonly lastReviewed: string;
}

// ---------------------------------------------------------------------------
// Economic indicators and second-order effects (§4.1 supply-chain module)
// ---------------------------------------------------------------------------

/**
 * One link in a transmission chain.
 *
 * The chain is stored as discrete links rather than a paragraph on purpose.
 * A narrative paragraph is exactly the "aggregation into an implied narrative"
 * §4.1 forbids; a chain of labelled links with stated lags is a model the
 * reader can inspect and disagree with one link at a time.
 */
export interface TransmissionLink {
  readonly from: string;
  readonly to: string;
  /** Typical delay before the first link shows up in the second. */
  readonly lag: string;
  /** How the link actually works, including where it is weaker than assumed. */
  readonly note: string;
}

/**
 * A measured economic value with a current reading.
 *
 * The distinction from a PostureNote matters and is the reason this may be a
 * live signal while a policy announcement may not: an indicator has a current
 * value, a baseline and a threshold, so it can fall as well as rise. A news
 * story has none of those and would only ever ratchet upward.
 */
export interface Indicator {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly current: number;
  /** ISO date of the reading. Staleness is shown, never hidden. */
  readonly asOf: string;
  readonly baseline: { readonly label: string; readonly value: number };
  readonly epistemicStatus: EpistemicStatus;
  readonly whatItIs: string;
  readonly reported?: string;
  readonly transmission: readonly TransmissionLink[];
  readonly whatItMeansForYou: string;
  /** What would falsify or end this. An indicator with no exit is a scare. */
  readonly wouldChangeThis: string;
  readonly citations: readonly Citation[];
  readonly pressCitations?: readonly {
    readonly source: string;
    readonly title: string;
    readonly published: string;
    readonly url?: string;
  }[];
  readonly lastReviewed: string;
}

// ---------------------------------------------------------------------------
// Commerce (§14)
// ---------------------------------------------------------------------------

/**
 * A purchasable offer for a catalog item.
 *
 * Deliberately a SEPARATE type from CatalogItem, loaded as a separate
 * artifact, and joined only AFTER recommendation ordering has been computed.
 * The ordering function cannot see this type, which is what makes "commerce
 * never reorders a recommendation" a property of the code rather than a
 * promise in a document.
 */
export interface Offer {
  readonly id: string;
  /** The catalog item this is an offer for. */
  readonly itemId: string;
  readonly merchant: string;
  readonly url: string;
  /** True when the link earns the publisher a commission. Always disclosed. */
  readonly affiliate: boolean;
  /**
   * ISO date the offer was checked. Stale offers stop linking.
   *
   * Note what is NOT here: a price.
   *
   * It used to be, and it was a compliance trap waiting to be stepped in.
   * Offers ship inside the signed content pack, which means a figure written
   * here sits on a phone for as long as that phone goes unopened — and
   * Amazon's Associates agreement requires any price shown to come from their
   * Product Advertising API and be under 24 hours old. An offline-first app
   * with a signed pack cannot satisfy that, ever, so the field could only
   * ever have been filled in wrongly.
   *
   * The app already has the honest number: `CatalogItem.typicalCostCents` is
   * a specification of what a thing costs, not a quote from a merchant, and
   * it is what the horizon planner does its arithmetic with. A link says
   * where to buy; the catalogue says roughly what it costs. Those are
   * different claims and keeping them apart is the point.
   */
  readonly asOf: string;
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
  readonly posture: readonly PostureNote[];
  readonly indicators: readonly Indicator[];
  readonly offers: readonly Offer[];
}
