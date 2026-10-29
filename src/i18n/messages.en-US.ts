/**
 * en-US message catalogue.
 *
 * No user-facing string may be hardcoded in a component (ARCHITECTURE §10).
 * English ships first, but the layer exists from commit one — §8 says do not
 * retrofit internationalisation, and it is right.
 *
 * Tone, per CONTENT_POLICY §4: factual, dry, occasionally funny. Humour lives
 * in empty states, loading text and section intros — never inside a safety
 * instruction.
 */
export const messages = {
  // --- Navigation -----------------------------------------------------------
  'nav.today': 'Today',
  'nav.supplies': 'Supplies',
  'nav.plan': 'Plan',
  'nav.skills': 'Skills',
  'nav.settings': 'Settings',

  // --- Readiness states (§3) ------------------------------------------------
  'state.blueSky': 'Blue Sky',
  'state.watch': 'Watch',
  'state.greySky': 'Grey Sky',
  'state.blueSky.summary': 'Nothing is happening. Good. Use it.',
  'state.watch.summary': 'Something is forming. Here is what to do in the next 48 hours.',
  'state.greySky.summary': 'It is happening.',

  // --- Grey Sky top level: four things only ---------------------------------
  'greySky.myPlan': 'My Plan',
  'greySky.water': 'Water',
  'greySky.shelterHeat': 'Shelter / Heat',
  'greySky.contact': 'Contact',

  // --- Coverage, the headline number (D16) ----------------------------------
  'coverage.heading': 'Your household is covered for',
  'coverage.water': '{days} of water',
  'coverage.calories': '{days} of calories',
  'coverage.heat': '{days} of heat',
  'coverage.power': '{days} of power',
  'coverage.sanitation': '{days} of sanitation',
  'coverage.days': '{n, plural, one {# day} other {# days}}',
  'coverage.none': 'not yet measured',
  'coverage.empty':
    'Nothing logged yet. Add one thing — a case of water counts. The number has to start somewhere.',

  // --- Readiness tiers, named after real doctrine ---------------------------
  'tier.unprepared': 'Unprepared',
  'tier.72hour': '72-Hour',
  'tier.twoWeek': 'Two-Week',
  'tier.oneMonth': 'One-Month',
  'tier.season': 'Season',

  // --- Kit ladder (§4.2) ----------------------------------------------------
  'kit.edc': 'Everyday Carry',
  'kit.ghb': 'Get Home Bag',
  'kit.bedside': 'Bedside',
  'kit.home': 'Home Kit',
  'kit.bob': 'Bug Out Bag',
  'kit.bov': 'Bug Out Vehicle',
  'kit.inch': 'INCH Bag',
  'kit.locked': 'Locked',
  'kit.locked.hint': 'Finish {prereq} first. Each rung is meant to be easy.',
  'kit.complete': 'Complete',
  'kit.criticalMissing': '{n} critical items missing',

  // --- Weight budgeting, the killer feature ---------------------------------
  'weight.heading': 'Carry weight',
  'weight.ofBodyweight': '{percent}% of your bodyweight',
  'weight.overBudget': 'Over budget by {amount}',
  'weight.tradeoff': 'Dropping the {item} buys you {gain}.',
  'weight.untested':
    'You have never carried this. A bag you cannot walk a mile with is a bag you will leave behind.',

  // --- Skills (§4.3) --------------------------------------------------------
  'skill.doesNotDo': 'What this does NOT do',
  'skill.failureModes': 'What usually goes wrong',
  'skill.materials': 'What you need',
  'skill.sources': 'Sources',
  'skill.lastReviewed': 'Last reviewed {date}',
  'skill.timeRequired': '{minutes} min',
  'skill.read': 'Read',
  'skill.practiced': 'Practiced',
  'skill.readNotPracticed':
    'You have read {read} and practiced {practiced}. Reading is not a filter.',
  'skill.risk.high': 'Getting this wrong can kill you. Read all of it.',

  // --- Offline and sync states (§2) -----------------------------------------
  'sync.lastSynced': 'Last synced {ago}',
  'sync.neverSynced': 'Never synced. Everything here still works.',
  'sync.offline': 'Offline. Everything here still works.',
  'sync.stale': '{stale} of {total} signals stale',

  // --- Threat feed (§4.1) ---------------------------------------------------
  'threat.nothingNotable': 'Nothing notable near you',
  'threat.nothingNotable.body':
    'Six signals checked, none of them interesting. This is what most days look like, and it is the correct result.',
  'threat.whatThisMeans': 'What this means for you',
  'threat.source': 'Source',
  'threat.digestEnds': 'That is everything. There is no more to scroll.',

  // --- Paper (§7) -----------------------------------------------------------
  'print.plan': 'Print household plan',
  'print.rallyCard': 'Print rally card (wallet-sized)',
  'print.contactCard': 'Print contact card',
  'print.checklist': 'Print supply checklist',
  'print.prompt':
    'Print this. The most likely failure in an emergency is a dead phone, and this app is on a phone.',

  // --- Empty and error states ----------------------------------------------
  'empty.supplies': 'No supplies logged. Start with water. It is always water.',
  'empty.plan': 'No plan yet. It takes about fifteen minutes and you only do it once.',
  'empty.contacts': 'No contacts yet. The one everyone forgets is the out-of-area contact.',
  'error.contentPack':
    'Content could not be verified, so the previous version is still active. Nothing is lost.',
} as const;

export type MessageKey = keyof typeof messages;
