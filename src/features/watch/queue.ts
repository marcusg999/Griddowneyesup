import type { CatalogItem } from '@/content/types';
import type { InventoryRecord, Profile } from '@/db/types';
import type { Contact, Plan } from '@/features/plan/types';
import type { Coverage } from '@/features/supply/coverage';
import type { RotationEntry } from '@/features/supply/rotation';

/**
 * The WATCH action queue. §3.
 *
 * WATCH is the state where something is forming and there is still time to do
 * something about it. The queue is the substance of that state — the summary
 * line already promises "here is what to do in the next 48 hours", and this is
 * the thing that makes the promise true.
 *
 * Every entry is derived from this household's own data. A static checklist
 * would be a worse version of the printed sheet, and it would tell a household
 * with thirty days of water stored to go and fill the bathtub.
 *
 * Three rules decide what qualifies:
 *
 *  1. It must be doable inside 48 hours, by this household, mostly for free.
 *     Acquiring a month of food is a Blue Sky activity and belongs in the
 *     acquisition path, not here.
 *  2. It must be derived, not assumed. Where the data cannot tell us whether
 *     an action even applies — whether anyone here takes prescription
 *     medicine, whether there is a car — the entry is omitted rather than
 *     guessed at. A queue that pads itself is a queue people stop reading.
 *  3. It carries no purchase links. `today` is a commerce-forbidden surface
 *     (CONTENT_POLICY §7.5) and the queue renders there.
 */

export type WatchActionId =
  | 'fill-water-containers'
  | 'improvise-water-storage'
  | 'refill-prescriptions'
  | 'charge-power'
  | 'fuel-vehicle'
  | 'draw-cash'
  | 'set-rally-point'
  | 'confirm-rally-point'
  | 'name-out-of-area-contact'
  | 'photograph-documents'
  | 'use-before-expiry';

export interface WatchAction {
  readonly id: WatchActionId;
  /** The instruction, as an imperative. */
  readonly title: string;
  /** Why this household, in this household's own figures where there are any. */
  readonly because: string;
  /** Where in the app the thing gets done, when the app is any help. */
  readonly href?: string;
}

export interface WatchInputs {
  readonly profile: Profile;
  readonly coverage: readonly Coverage[];
  readonly inventory: readonly InventoryRecord[];
  readonly catalog: readonly CatalogItem[];
  readonly plan: Plan;
  readonly contacts: readonly Contact[];
  readonly rotation: readonly RotationEntry[];
}

/**
 * An empty container holds no water, which is exactly why it earns its own
 * action: the gap between owning storage and having it full is the cheapest
 * gap in the whole product to close, and it closes in minutes.
 */
const WATER_CONTAINER = 'water-container-7gal';
const CASH = 'cash-small-bills';
const PRESCRIPTIONS = 'meds-prescription-30d';

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

function heldQuantities(inventory: readonly InventoryRecord[]): Map<string, number> {
  const held = new Map<string, number>();
  for (const record of inventory) {
    if (record.quantity > 0) {
      held.set(record.itemId, (held.get(record.itemId) ?? 0) + record.quantity);
    }
  }
  return held;
}

/**
 * Builds the queue, most urgent first.
 *
 * The order is fixed rather than scored. Water is first because water is
 * always first; medicine follows because it is the one shortage that cannot be
 * improvised; the plan entries come last because talking is the part people
 * will still do at hour 47.
 */
export function watchQueue(input: WatchInputs): readonly WatchAction[] {
  const { profile, coverage, inventory, plan, contacts, rotation } = input;
  const held = heldQuantities(inventory);
  const actions: WatchAction[] = [];

  const target = profile.targetHorizonDays;
  const water = coverage.find((c) => c.resource === 'water-litres');
  const waterDays = water?.days;
  const waterShort = water !== undefined && water.dailyNeed > 0 && (waterDays ?? 0) < target;

  if (waterShort) {
    const containers = held.get(WATER_CONTAINER) ?? 0;

    // "About 3 days short of your 3-day target" is arithmetically true and
    // reads like a machine. A household at zero gets told it is at zero.
    const gap =
      (waterDays ?? 0) <= 0
        ? `You have no stored water logged against a ${target}-day target`
        : `You are about ${plural(Math.ceil(target - (waterDays ?? 0)), 'day', 'days')} short of your ${target}-day target`;

    if (containers > 0) {
      actions.push({
        id: 'fill-water-containers',
        title: `Fill the ${plural(containers, 'container', 'containers')} you already own`,
        because: `${gap}, and empty storage counts for nothing. This costs you tap water and ten minutes.`,
        href: '/supplies',
      });
    } else {
      actions.push({
        id: 'improvise-water-storage',
        title: 'Fill the bathtub, every pot and every bottle',
        because: `${gap}, and no containers to put it in. Mains pressure is the thing that goes first, and it goes without warning.`,
        href: '/skills/water-storage',
      });
    }
  }

  // Only when the household has told us it keeps prescriptions. Whether anyone
  // here takes medicine is not ours to infer, and §5 keeps us to supply and
  // records — never dose.
  const prescriptionRun = rotation.find(
    (entry) =>
      entry.record.itemId === PRESCRIPTIONS &&
      (entry.bucket === 'expired' || entry.bucket === 'this-month'),
  );
  if (prescriptionRun) {
    const days = prescriptionRun.daysRemaining;
    actions.push({
      id: 'refill-prescriptions',
      title: 'Ask for the refill today',
      because:
        days < 0
          ? `Your logged prescription supply ran out ${plural(Math.abs(days), 'day', 'days')} ago. Pharmacies lose power and deliveries with everyone else.`
          : `Your logged prescription supply runs out in ${plural(days, 'day', 'days')}. A pharmacy will often fill early if you say why, and it cannot fill at all without power.`,
      href: '/plan',
    });
  }

  // Anything that stores watt-hours is worth topping up while there is a grid
  // to do it from.
  const powerItems = input.catalog.filter((item) =>
    (item.provides ?? []).some((c) => c.resource === 'power-wh'),
  );
  const powerOnHand = powerItems.filter((item) => (held.get(item.id) ?? 0) > 0);
  if (powerOnHand.length > 0) {
    actions.push({
      id: 'charge-power',
      title: 'Charge every bank and check the spare cells',
      because: `You have ${plural(powerOnHand.length, 'kind', 'kinds')} of stored power logged. A bank at 40% is a bank that dies on the second evening, and banks self-discharge while they sit.`,
    });
  }

  // Fuel only when the household has told us it buys fuel. Guessing at car
  // ownership from a dwelling type would be a fabrication.
  if (profile.monthlyFuelSpendCents !== undefined) {
    actions.push({
      id: 'fuel-vehicle',
      title: 'Fill the tank before the queue forms',
      because:
        'Pumps run on grid power, so a station without power is a station with fuel you cannot buy. The queues form within hours of a warning, not after the event.',
    });
  }

  if ((held.get(CASH) ?? 0) <= 0) {
    actions.push({
      id: 'draw-cash',
      title: 'Draw small bills',
      because:
        'Card terminals and cash machines both need power and a network. Small bills matter because nobody will be making change.',
      href: '/supplies',
    });
  }

  const rally = plan.rallyPrimary?.where?.trim();
  if (!rally) {
    actions.push({
      id: 'set-rally-point',
      title: 'Agree one place to meet',
      because:
        'Your plan has no rally point. Phones fail first and separately, and a household without an agreed place spends the first hours looking for each other.',
      href: '/plan',
    });
  } else {
    actions.push({
      id: 'confirm-rally-point',
      title: 'Say the rally point out loud to everyone',
      because: `It is written down as "${rally}" — which is worth nothing if one person has not heard it, or heard it two years ago.`,
      href: '/plan',
    });
  }

  if (!contacts.some((c) => c.outOfArea)) {
    actions.push({
      id: 'name-out-of-area-contact',
      title: 'Name someone two states away',
      because:
        'Local lines and local people are busy or unreachable in a local event. Someone far enough away to be unaffected can relay between people who cannot reach each other.',
      href: '/plan',
    });
  }

  const uncopied = plan.documents.filter((d) => !d.copied).length;
  if (uncopied > 0) {
    actions.push({
      id: 'photograph-documents',
      title: `Photograph the ${plural(uncopied, 'document', 'documents')} you have not copied`,
      because:
        'It takes a minute per document now and cannot be done at all once you have left the house without them.',
      href: '/plan',
    });
  }

  // The rotation queue already surfaces these in Blue Sky; in WATCH the framing
  // changes from "use it up some time" to "it is not going to count tomorrow".
  const perishing = rotation.filter(
    (entry) =>
      entry.record.itemId !== PRESCRIPTIONS &&
      (entry.bucket === 'expired' || entry.bucket === 'this-month'),
  );
  if (perishing.length > 0) {
    actions.push({
      id: 'use-before-expiry',
      title: `Check the ${plural(perishing.length, 'item', 'items')} at or past their date`,
      because:
        'Stock you are counting on and would not actually eat is not stock. Better to find that out now than at hour six.',
      href: '/supplies',
    });
  }

  return actions;
}
