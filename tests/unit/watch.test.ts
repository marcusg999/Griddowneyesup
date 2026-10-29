import { describe, expect, it } from 'vitest';
import { watchQueue, type WatchInputs } from '@/features/watch/queue';
import { EMPTY_PLAN, type Contact, type Plan } from '@/features/plan/types';
import type { CatalogItem } from '@/content/types';
import type { InventoryRecord, Profile } from '@/db/types';
import type { Coverage } from '@/features/supply/coverage';
import type { RotationEntry } from '@/features/supply/rotation';

const catalog: CatalogItem[] = [
  {
    id: 'water-container-7gal',
    name: '7 gallon container',
    spec: '',
    category: 'water',
    unit: 'each',
    weightG: 1000,
    costTier: 'tier-50',
    valuePerDollar: 10,
  },
  {
    id: 'cash-small-bills',
    name: 'Small bills',
    spec: '',
    category: 'cash',
    unit: 'USD',
    weightG: 1,
    costTier: 'tier-200',
    valuePerDollar: 10,
  },
  {
    id: 'powerbank-20k',
    name: 'Power bank',
    spec: '',
    category: 'power',
    unit: 'each',
    weightG: 400,
    costTier: 'tier-50',
    valuePerDollar: 10,
    provides: [{ resource: 'power-wh', perUnit: 74 }],
  },
  {
    id: 'meds-prescription-30d',
    name: 'Prescriptions',
    spec: '',
    category: 'medical',
    unit: 'person-month',
    weightG: 100,
    costTier: 'tier-50',
    valuePerDollar: 10,
  },
];

const profile: Profile = {
  id: 'self',
  members: [{ id: 'a', label: 'A', ageBand: 'adult' }],
  pets: 0,
  hazards: [],
  targetHorizonDays: 14,
  carryFraction: 0.2,
};

const record = (itemId: string, quantity = 1, expiresOn?: string): InventoryRecord => ({
  id: `${itemId}-1`,
  itemId,
  quantity,
  kits: [],
  addedAt: '2026-01-01T00:00:00.000Z',
  ...(expiresOn ? { expiresOn } : {}),
});

const rotationEntry = (
  itemId: string,
  daysRemaining: number,
): RotationEntry => ({
  record: record(itemId),
  item: catalog.find((c) => c.id === itemId),
  bucket: daysRemaining < 0 ? 'expired' : 'this-month',
  daysRemaining,
});

/** Water covered to target, so the water actions stay out of the way. */
const waterCovered: Coverage[] = [
  { resource: 'water-litres', stock: 1000, dailyNeed: 3.8, days: 30 },
];
const waterShort: Coverage[] = [
  { resource: 'water-litres', stock: 20, dailyNeed: 3.8, days: 5 },
];

const inputs = (over: Partial<WatchInputs> = {}): WatchInputs => ({
  profile,
  coverage: waterCovered,
  inventory: [record('cash-small-bills', 200)],
  catalog,
  plan: { ...EMPTY_PLAN, rallyPrimary: { where: 'The oak by the mailboxes' } } as Plan,
  contacts: [{ id: 'c', name: 'Sam', outOfArea: true }] as Contact[],
  rotation: [],
  ...over,
});

const ids = (over: Partial<WatchInputs> = {}) => watchQueue(inputs(over)).map((a) => a.id);

describe('the WATCH action queue', () => {
  it('is derived, not a checklist — a covered household gets a short queue', () => {
    // Everything in order: water to target, cash on hand, rally point set,
    // out-of-area contact named, nothing expiring, no fuel spend recorded.
    expect(ids()).toEqual(['confirm-rally-point']);
  });

  it('puts water first, because it is always water', () => {
    const queue = ids({ coverage: waterShort, inventory: [record('water-container-7gal', 2)] });
    expect(queue[0]).toBe('fill-water-containers');
  });

  it('says fill what you own when there are containers', () => {
    const [action] = watchQueue(
      inputs({ coverage: waterShort, inventory: [record('water-container-7gal', 2)] }),
    );
    expect(action?.id).toBe('fill-water-containers');
    expect(action?.title).toContain('2 containers');
    // Quantified against this household's own target, not a generic figure.
    expect(action?.because).toContain('9 days');
    expect(action?.because).toContain('14-day');
  });

  it('tells a household at zero that it is at zero, rather than doing arithmetic', () => {
    const dry: Coverage[] = [
      { resource: 'water-litres', stock: 0, dailyNeed: 3.8, days: 0 },
    ];
    const [action] = watchQueue(inputs({ coverage: dry, inventory: [] }));
    expect(action?.because).toContain('no stored water logged against a 14-day target');
    // "About 14 days short of your 14-day target" is true and reads like a machine.
    expect(action?.because).not.toContain('14 days short');
  });

  it('says improvise when the household owns no containers', () => {
    const queue = watchQueue(inputs({ coverage: waterShort, inventory: [] }));
    const water = queue.find((a) => a.id === 'improvise-water-storage');
    expect(water).toBeDefined();
    expect(queue.some((a) => a.id === 'fill-water-containers')).toBe(false);
    expect(water?.href).toBe('/skills/water-storage');
  });

  it('singularises one container', () => {
    const [action] = watchQueue(
      inputs({ coverage: waterShort, inventory: [record('water-container-7gal', 1)] }),
    );
    expect(action?.title).toContain('1 container you');
  });

  describe('things it refuses to assume', () => {
    it('does not raise fuel unless the household has said it buys fuel', () => {
      expect(ids()).not.toContain('fuel-vehicle');
      expect(ids({ profile: { ...profile, monthlyFuelSpendCents: 20_000 } })).toContain(
        'fuel-vehicle',
      );
    });

    it('does not raise prescriptions for a household that logs none', () => {
      // Whether anyone here takes medicine is not ours to infer.
      expect(ids()).not.toContain('refill-prescriptions');
      expect(ids({ rotation: [rotationEntry('meds-prescription-30d', 5)] })).toContain(
        'refill-prescriptions',
      );
    });

    it('does not raise charging for a household with no stored power', () => {
      expect(ids()).not.toContain('charge-power');
      expect(ids({ inventory: [record('powerbank-20k', 2)] })).toContain('charge-power');
    });
  });

  describe('the plan entries', () => {
    it('asks for a rally point when there is none, and confirmation when there is', () => {
      expect(ids({ plan: EMPTY_PLAN })).toContain('set-rally-point');
      expect(ids({ plan: EMPTY_PLAN })).not.toContain('confirm-rally-point');
      expect(ids()).toContain('confirm-rally-point');
    });

    it('quotes the rally point back, since an unheard one is worth nothing', () => {
      const action = watchQueue(inputs()).find((a) => a.id === 'confirm-rally-point');
      expect(action?.because).toContain('The oak by the mailboxes');
    });

    it('treats a whitespace-only rally point as absent', () => {
      const plan = { ...EMPTY_PLAN, rallyPrimary: { where: '   ' } } as Plan;
      expect(ids({ plan })).toContain('set-rally-point');
    });

    it('asks for an out-of-area contact only when none is named', () => {
      expect(ids()).not.toContain('name-out-of-area-contact');
      const local = [{ id: 'c', name: 'Sam', outOfArea: false }] as Contact[];
      expect(ids({ contacts: local })).toContain('name-out-of-area-contact');
    });

    it('counts only the uncopied documents', () => {
      const plan = {
        ...EMPTY_PLAN,
        documents: [
          { id: 'id', label: 'ID', copied: true },
          { id: 'deed', label: 'Deed', copied: false },
        ],
      } as Plan;
      const action = watchQueue(inputs({ plan })).find((a) => a.id === 'photograph-documents');
      expect(action?.title).toContain('1 document');
    });
  });

  describe('expiry', () => {
    it('raises expiring stock, but not prescriptions twice', () => {
      const rotation = [
        rotationEntry('meds-prescription-30d', 3),
        rotationEntry('water-container-7gal', -2),
      ];
      const queue = ids({ rotation });
      expect(queue.filter((id) => id === 'refill-prescriptions')).toHaveLength(1);
      const expiry = watchQueue(inputs({ rotation })).find((a) => a.id === 'use-before-expiry');
      expect(expiry?.title).toContain('1 item');
    });

    it('reports a run-out in the past as past', () => {
      const action = watchQueue(
        inputs({ rotation: [rotationEntry('meds-prescription-30d', -4)] }),
      ).find((a) => a.id === 'refill-prescriptions');
      expect(action?.because).toContain('ran out 4 days ago');
    });
  });

  it('carries no purchase links anywhere — today is a commerce-forbidden surface', () => {
    const everything = watchQueue(
      inputs({
        coverage: waterShort,
        inventory: [record('powerbank-20k', 1), record('water-container-7gal', 1)],
        plan: EMPTY_PLAN,
        contacts: [],
        profile: { ...profile, monthlyFuelSpendCents: 10_000 },
        rotation: [rotationEntry('meds-prescription-30d', 1), rotationEntry('powerbank-20k', -1)],
      }),
    );

    // Every entry is either an in-app route or no link at all. Nothing leaves
    // the origin, so no offer can reach this surface.
    for (const action of everything) {
      if (action.href !== undefined) expect(action.href.startsWith('/')).toBe(true);
    }
    expect(everything.length).toBeGreaterThan(6);
  });

  it('always returns at least one action', () => {
    // The invariant the UI leans on: there is no empty-queue state to design,
    // because re-confirming the meet point is always worth thirty seconds in a
    // WATCH window, however well stocked the household is.
    expect(watchQueue(inputs()).length).toBeGreaterThan(0);
    expect(watchQueue(inputs({ plan: EMPTY_PLAN, contacts: [] })).length).toBeGreaterThan(0);
  });

  it('ignores inventory records held at zero quantity', () => {
    // A record kept at zero is a thing you used up, not a thing you have.
    expect(ids({ inventory: [record('cash-small-bills', 0)] })).toContain('draw-cash');
  });
});
