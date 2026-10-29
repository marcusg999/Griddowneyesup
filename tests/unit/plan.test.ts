import { describe, expect, it } from 'vitest';
import { planCompleteness, planSections } from '@/features/plan/completeness';
import { EMPTY_PLAN, type Contact, type Plan } from '@/features/plan/types';
import type { Profile } from '@/db/types';

const soloAdult: Profile = {
  id: 'self',
  members: [{ id: 'm1', label: 'You', ageBand: 'adult' }],
  pets: 0,
  hazards: [],
  targetHorizonDays: 3,
  carryFraction: 0.2,
};

const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c1',
  name: 'Ruth',
  phone: '+1 555 0137',
  outOfArea: true,
  ...over,
});

const filled: Plan = {
  ...EMPTY_PLAN,
  rallyPrimary: { where: 'The oak' },
  rallySecondary: { where: 'Library car park' },
  routes: [
    { label: 'Primary', via: 'Route 9' },
    { label: 'Alternate', via: 'Quarry Rd' },
  ],
  gas: { location: 'Side of house' },
  water: { location: 'Basement' },
  electric: { location: 'Garage' },
};

import type { SectionState } from '@/features/plan/completeness';

const find = (sections: readonly SectionState[], id: string): SectionState => {
  const section = sections.find((s) => s.id === id);
  if (!section) throw new Error(`no section "${id}"`);
  return section;
};

describe('plan completeness', () => {
  it('an empty plan is not usable and every critical section is open', () => {
    const c = planCompleteness(EMPTY_PLAN, [], soloAdult);
    expect(c.usable).toBe(false);
    expect(c.sections.filter((s) => s.critical && s.done)).toEqual([]);
    // Dependents counts as done for a household that has none, which is why
    // doneCount is not zero here. Nothing to do is a legitimate kind of done.
    expect(find(c.sections, 'dependents').done).toBe(true);
  });

  it('becomes usable once every critical section is filled', () => {
    const c = planCompleteness(filled, [contact()], soloAdult);
    expect(c.criticalGaps).toEqual([]);
    expect(c.usable).toBe(true);
  });

  it('treats a missing out-of-area contact as critical', () => {
    // The single most forgotten element of a household plan.
    const c = planCompleteness(filled, [contact({ outOfArea: false })], soloAdult);
    expect(c.usable).toBe(false);
    expect(find(c.sections, 'contacts').missing).toContain('An out-of-area contact');
  });

  it('wants a contact to have a number, not just a name', () => {
    const c = planCompleteness(filled, [contact({ phone: '' })], soloAdult);
    expect(find(c.sections, 'contacts').done).toBe(false);
  });

  it('requires an alternate route, not just one way out', () => {
    // The obvious road out is the one everyone else takes, or the closed one.
    const oneRoute = { ...filled, routes: [{ label: 'Primary', via: 'Route 9' }] };
    const c = planCompleteness(oneRoute, [contact()], soloAdult);
    expect(find(c.sections, 'routes').done).toBe(false);
    expect(find(c.sections, 'routes').missing).toContain('At least one alternate route');
  });

  it('names every missing utility shutoff individually', () => {
    const noUtils = { ...filled, gas: undefined, water: undefined, electric: undefined };
    const missing = find(planSections(noUtils, [contact()], soloAdult), 'utilities').missing;
    expect(missing).toHaveLength(3);
    expect(missing).toContain('Gas shutoff location');
  });

  it('does not ask a household with no dependents for a school plan', () => {
    // A plan that demands irrelevant sections trains people to skip sections.
    const section = find(planSections(filled, [contact()], soloAdult), 'dependents');
    expect(section.critical).toBe(false);
    expect(section.done).toBe(true);
  });

  it('does ask a household with a child and a pet', () => {
    const family: Profile = {
      ...soloAdult,
      members: [
        ...soloAdult.members,
        { id: 'm2', label: 'Kid', ageBand: 'child' },
      ],
      pets: 1,
    };
    const section = find(planSections(filled, [contact()], family), 'dependents');
    expect(section.critical).toBe(true);
    expect(section.missing).toContain('Pet plan');
    expect(section.missing).toContain('School / childcare plan');
    expect(planCompleteness(filled, [contact()], family).usable).toBe(false);
  });

  it('treats blank-but-present strings as missing', () => {
    const whitespace = { ...filled, rallyPrimary: { where: '   ' } };
    expect(find(planSections(whitespace, [contact()], soloAdult), 'rally').done).toBe(false);
  });

  it('does not block a usable plan on optional sections', () => {
    // Check-in phrases and documents are worth having and are not what makes
    // the difference between a plan and no plan.
    const c = planCompleteness(filled, [contact()], soloAdult);
    expect(find(c.sections, 'checkin').done).toBe(false);
    expect(c.usable).toBe(true);
  });
});
