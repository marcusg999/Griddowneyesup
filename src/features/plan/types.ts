/**
 * Household emergency plan. §4.4.
 *
 * Every field here is classified `sensitive` (D05): rally points are where
 * your family will physically be, duress codes are what they mean when
 * something is wrong, and the document inventory lists what is worth stealing.
 * None of it leaves the device in v1, and the cipher boundary enforces that
 * rather than a comment asking nicely.
 *
 * Everything is optional. A plan is built in fragments over weeks, and a
 * schema that refuses to hold a half-finished plan is a schema that guarantees
 * no plan exists at all.
 */

export interface RallyPoint {
  /** Where it is, in words a stranger could follow. */
  readonly where: string;
  /** How to get there, what it looks like, where exactly to stand. */
  readonly notes?: string;
}

export interface EvacRoute {
  readonly label: string;
  /** Compass direction out. Useful when the named roads are gone. */
  readonly direction?: string;
  /** The roads themselves. */
  readonly via: string;
  readonly notes?: string;
}

export interface Shutoff {
  /** Where the valve or breaker physically is. */
  readonly location: string;
  /** The tool it needs, and where that tool lives. */
  readonly tool?: string;
  readonly notes?: string;
}

export interface DocumentItem {
  readonly id: string;
  readonly label: string;
  /** Physical or digital location. Never the document contents. */
  readonly storedAt?: string;
  readonly copied: boolean;
}

export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly relationship?: string;
  readonly phone?: string;
  readonly altPhone?: string;
  /**
   * The single most forgotten element of a household plan. Local lines and
   * local people are busy or unreachable in a local event; someone two states
   * away is not, and they can relay between people who cannot reach each other.
   */
  readonly outOfArea: boolean;
  readonly roleInPlan?: string;
}

export interface Plan {
  readonly id: 'household';

  readonly rallyPrimary?: RallyPoint;
  readonly rallySecondary?: RallyPoint;
  readonly rallyOutOfArea?: RallyPoint;

  /** Contact id of the designated out-of-area relay. */
  readonly outOfAreaContactId?: string;

  readonly routes: readonly EvacRoute[];

  readonly shelterRoom?: string;
  readonly shelterNotes?: string;

  readonly gas?: Shutoff;
  readonly water?: Shutoff;
  readonly electric?: Shutoff;

  readonly petPlan?: string;
  readonly schoolPlan?: string;
  readonly mobilityPlan?: string;

  readonly documents: readonly DocumentItem[];

  /**
   * A phrase meaning "I am fine, this is a normal check-in", and one meaning
   * "I am not fine". Agreed in advance because under stress people say they
   * are fine by reflex, and because a phrase can be said in front of someone.
   */
  readonly checkInPhrase?: string;
  readonly duressPhrase?: string;
  readonly checkInCadence?: string;

  readonly updatedAt?: string;
}

export const EMPTY_PLAN: Plan = {
  id: 'household',
  routes: [],
  documents: [],
};

/**
 * The documents people actually need and reliably do not have copies of.
 * Seeded unchecked so the list is a prompt rather than a blank page.
 */
export const DEFAULT_DOCUMENTS: readonly DocumentItem[] = [
  { id: 'id', label: 'Photo ID for each household member', copied: false },
  { id: 'birth', label: 'Birth certificates', copied: false },
  { id: 'insurance', label: 'Insurance policies (home, auto, health, life)', copied: false },
  { id: 'deed', label: 'Deed, lease or mortgage papers', copied: false },
  { id: 'medical', label: 'Prescriptions and medical records', copied: false },
  { id: 'bank', label: 'Bank and account details', copied: false },
  { id: 'immunisation', label: 'Pet vaccination records', copied: false },
  { id: 'photos', label: 'Photographs of each household member and pet', copied: false },
];
