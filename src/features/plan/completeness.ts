import type { Contact, Plan } from './types';
import type { Profile } from '@/db/types';

/**
 * What is in the plan, and what is conspicuously not.
 *
 * Drives the builder's progress and, more importantly, the warning printed on
 * the plan itself. A printed plan with a blank rally point is worse than no
 * printed plan, because it looks finished.
 */

export type SectionId =
  | 'rally'
  | 'contacts'
  | 'routes'
  | 'shelter'
  | 'utilities'
  | 'dependents'
  | 'documents'
  | 'checkin';

export interface SectionState {
  readonly id: SectionId;
  readonly title: string;
  /** One line on why this section exists. */
  readonly why: string;
  /** A plan without every critical section is not a usable plan. */
  readonly critical: boolean;
  readonly done: boolean;
  /** What is still missing, in the order worth fixing it. */
  readonly missing: readonly string[];
}

const nonEmpty = (s: string | undefined): boolean => (s ?? '').trim().length > 0;

export function planSections(
  plan: Plan,
  contacts: readonly Contact[],
  profile: Profile | undefined,
): SectionState[] {
  const sections: SectionState[] = [];

  // --- Rally points --------------------------------------------------------
  const rallyMissing: string[] = [];
  if (!nonEmpty(plan.rallyPrimary?.where)) rallyMissing.push('Primary rally point');
  if (!nonEmpty(plan.rallySecondary?.where)) rallyMissing.push('Secondary rally point');
  if (!nonEmpty(plan.rallyOutOfArea?.where)) rallyMissing.push('Out-of-area rally point');
  sections.push({
    id: 'rally',
    title: 'Rally points',
    why: 'Where people go when they cannot reach each other or get home.',
    critical: true,
    done: nonEmpty(plan.rallyPrimary?.where) && nonEmpty(plan.rallySecondary?.where),
    missing: rallyMissing,
  });

  // --- Contacts ------------------------------------------------------------
  const outOfArea = contacts.filter((c) => c.outOfArea);
  const contactsMissing: string[] = [];
  if (contacts.length === 0) contactsMissing.push('Any contacts at all');
  if (outOfArea.length === 0) contactsMissing.push('An out-of-area contact');
  if (contacts.some((c) => !nonEmpty(c.phone))) {
    contactsMissing.push('A phone number for every contact');
  }
  sections.push({
    id: 'contacts',
    title: 'Contacts',
    why: 'Local lines jam in a local event. Someone far away can relay.',
    critical: true,
    done: outOfArea.length > 0 && outOfArea.every((c) => nonEmpty(c.phone)),
    missing: contactsMissing,
  });

  // --- Evacuation routes ---------------------------------------------------
  const routesMissing: string[] = [];
  if (plan.routes.length === 0) routesMissing.push('A primary route out');
  if (plan.routes.length < 2) routesMissing.push('At least one alternate route');
  sections.push({
    id: 'routes',
    title: 'Evacuation routes',
    why: 'The obvious road out is the one everyone else takes, or the one that is closed.',
    critical: true,
    done: plan.routes.length >= 2,
    missing: routesMissing,
  });

  // --- Shelter in place ----------------------------------------------------
  sections.push({
    id: 'shelter',
    title: 'Shelter in place',
    why: 'Which room, and what you do to it.',
    critical: false,
    done: nonEmpty(plan.shelterRoom),
    missing: nonEmpty(plan.shelterRoom) ? [] : ['The room you would use'],
  });

  // --- Utility shutoffs ----------------------------------------------------
  const utilMissing: string[] = [];
  if (!nonEmpty(plan.gas?.location)) utilMissing.push('Gas shutoff location');
  if (!nonEmpty(plan.water?.location)) utilMissing.push('Water shutoff location');
  if (!nonEmpty(plan.electric?.location)) utilMissing.push('Electrical panel location');
  sections.push({
    id: 'utilities',
    title: 'Utility shutoffs',
    why: 'Found in daylight, not by torchlight with the smell of gas in the house.',
    critical: true,
    done: utilMissing.length === 0,
    missing: utilMissing,
  });

  // --- Dependents ----------------------------------------------------------
  // Only asked for where the household actually has them. A plan that demands
  // a school plan from someone with no children trains people to skip sections.
  const dependentIds = new Set(
    (profile?.members ?? []).flatMap((m) => m.dependents ?? []),
  );
  const needsPet = (profile?.pets ?? 0) > 0 || dependentIds.has('pet');
  const needsSchool = dependentIds.has('child') ||
    (profile?.members ?? []).some((m) => m.ageBand === 'child');
  const needsMobility = dependentIds.has('mobility') || dependentIds.has('elder') ||
    (profile?.members ?? []).some((m) => m.ageBand === 'elder');

  const depMissing: string[] = [];
  if (needsPet && !nonEmpty(plan.petPlan)) depMissing.push('Pet plan');
  if (needsSchool && !nonEmpty(plan.schoolPlan)) depMissing.push('School / childcare plan');
  if (needsMobility && !nonEmpty(plan.mobilityPlan)) depMissing.push('Mobility plan');

  const anyNeeded = needsPet || needsSchool || needsMobility;
  sections.push({
    id: 'dependents',
    title: 'Dependents',
    why: 'Anyone who cannot execute the plan without help.',
    critical: anyNeeded,
    done: depMissing.length === 0,
    missing: depMissing,
  });

  // --- Documents -----------------------------------------------------------
  const copied = plan.documents.filter((d) => d.copied).length;
  sections.push({
    id: 'documents',
    title: 'Documents',
    why: 'Replacing them afterwards is months of your life.',
    critical: false,
    done: copied > 0 && copied >= Math.ceil(plan.documents.length / 2),
    missing: plan.documents.filter((d) => !d.copied).map((d) => d.label),
  });

  // --- Check-in and duress -------------------------------------------------
  const checkMissing: string[] = [];
  if (!nonEmpty(plan.checkInPhrase)) checkMissing.push('A check-in phrase');
  if (!nonEmpty(plan.duressPhrase)) checkMissing.push('A duress phrase');
  sections.push({
    id: 'checkin',
    title: 'Check-in codes',
    why: 'Under stress people say they are fine by reflex. Agree the words in advance.',
    critical: false,
    done: nonEmpty(plan.checkInPhrase),
    missing: checkMissing,
  });

  return sections;
}

export interface PlanCompleteness {
  readonly sections: readonly SectionState[];
  readonly doneCount: number;
  readonly total: number;
  /** Critical sections still incomplete. The plan is not usable until zero. */
  readonly criticalGaps: readonly SectionState[];
  /** True only when every critical section is done. */
  readonly usable: boolean;
}

export function planCompleteness(
  plan: Plan,
  contacts: readonly Contact[],
  profile: Profile | undefined,
): PlanCompleteness {
  const sections = planSections(plan, contacts, profile);
  const criticalGaps = sections.filter((s) => s.critical && !s.done);
  return {
    sections,
    doneCount: sections.filter((s) => s.done).length,
    total: sections.length,
    criticalGaps,
    usable: criticalGaps.length === 0,
  };
}
