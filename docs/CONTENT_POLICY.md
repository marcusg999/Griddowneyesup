# Content Policy

Binding on all content ingestion, authoring, and product mechanics.
Implements brief §5 (content boundaries), §4.3 (safety standard), §6 (tone), and
D16 (gamification constraints).

This is not squeamishness. It is what keeps the app in the app stores, keeps the
payment processor, keeps the insurance, and keeps the brand serious rather than
fringe.

**This file is a review gate, not a guideline.** The ingestion pipeline reads it
as config. CI reads it as assertions. A change here is a change to the build.

---

## 1. Scope

The app covers preparedness, self-sufficiency, and survival.

### 1.1 Excluded — hard

No content, in any form, covering:

- **E01** Manufacture, modification, or improvement of weapons, ammunition, or
  explosives
- **E02** Booby traps, improvised munitions, or offensive tactics
- **E03** Invasive medical procedures beyond trained-layperson scope
- **E04** Dosing guidance for prescription or controlled substances
- **E05** Anything framed around confrontation with, or evasion of, lawful
  authority

### 1.2 Personal defense — how it is handled

Personal defense is in scope **as planning only**:

| In scope | Out of scope |
|---|---|
| Situational awareness | Combatives, hand-to-hand technique |
| De-escalation | Weapon handling or selection |
| Avoidance and routing | Force-on-force tactics |
| Legal self-defense considerations by jurisdiction | Anything that reads as training |
| Securing a dwelling (locks, lighting, sightlines) | Fortification against persons |

Grey man principles — dress, movement, routine variation, digital footprint, not
being the interesting one in the room — are **in scope**. They are avoidance,
not confrontation, and are explicitly distinct from E05: the purpose is not
being noticed by opportunists, never evading lawful authority. Any grey man
content that drifts toward the latter is rejected.

---

## 2. Ingestion filter

> **Fail closed. Anything unclassified is rejected, not reviewed later.**

The standard survival corpus contains excluded material. The commonly circulated
military-manual libraries bundle improvised-munitions handbooks, combatives and
hand-to-hand manuals, tracking and countertracking, and urban warfare doctrine
alongside the genuinely useful survival, sanitation, navigation and first-aid
manuals.

**Filtering happens at the document level, not the topic level.** A document is
accepted or rejected whole. Extracting the acceptable chapters from an excluded
document is not permitted — it launders provenance and defeats the audit trail.

### 2.1 Pipeline states

| State | Meaning | Action |
|---|---|---|
| `allowed` | Explicitly listed in the allowlist | Ingest |
| `excluded` | Matches a denylist rule | Reject, log reason |
| `unclassified` | Neither | **Reject.** Requires human classification before it can be reconsidered. |

There is no fourth state and no automatic promotion out of `unclassified`.

### 2.2 Document-level denylist

Reject any source document whose title, subject classification, or publishing
body indicates it is primarily concerned with:

```
improvised munitions · explosives · demolitions · booby traps · mines
combatives · hand-to-hand · close quarters battle · marksmanship
sniping · tracking · countertracking · counterinsurgency
urban warfare · ambush · raid · interrogation · psychological operations
unconventional warfare · special forces operations · evasion from authority
```

Reject the document even where it also contains valuable survival, medical or
navigation material. The acceptable content in such documents is reliably
available from a clean source.

### 2.3 Provenance record

Every ingested document carries, permanently:

- Source body, title, publication date, retrieval URL, retrieval date
- Public-domain basis (`17 USC 105 federal work` or `pre-1929 publication`)
- Classification decision, who made it, when
- SHA-256 of the retrieved artifact

No content enters the library without a complete provenance record.

---

## 3. Safety standard

### 3.1 Citation-bound authoring (D09)

> **We ship no safety claim that is not traceable to a named authoritative source.
> The federal agency is the authority. We are the translator.**

Enforced in CI:

- Any skill at `riskTier: high` **must** carry ≥1 citation. Build fails otherwise.
- Any skill missing `lastReviewed` fails the build.
- Any skill missing `doesNotDo` fails the build. See 3.2.
- `lastReviewed` older than 12 months raises a staleness warning in the content
  admin view. Older than 18 months fails the build.

### 3.2 The `doesNotDo` requirement — mandatory on every skill

> **Say what a technique does *not* do.**

This is the single most important content rule in the product, and it is
enforced by schema rather than by discipline.

**The water case is the template.** Filtration and purification are different
operations and conflating them kills people:

- A DIY sand-and-charcoal column improves **clarity, sediment and taste**. It
  does **not** make water microbiologically safe.
- Most filters do **not** remove viruses.
- Boiling, chemical treatment and UV are **purification**, not filtration.

Every water skill states explicitly what it does and does not remove, and the UI
makes the distinction impossible to miss — a dedicated, high-contrast block, not
a footnote.

The same standard applies library-wide. A skill that cannot articulate its own
limits is not understood well enough to publish.

### 3.3 Risk tiers

| Tier | Meaning | Requirements |
|---|---|---|
| `low` | Failure wastes time or materials | Citation encouraged |
| `medium` | Failure causes illness, injury, or loss of a critical resource | Citation required, failure modes required |
| `high` | Failure can kill or permanently injure | Citation required, failure modes required, flat plain prose mandatory (§6), professional review flagged for v1.1 |

### 3.4 Medical scope

Trained-layperson scope only. No invasive procedures. No dosing guidance for
prescription or controlled substances. Where a situation exceeds scope, the
content says so plainly and stops — it does not improvise.

### 3.5 Honest framing of institutional response

Government and NGO resources are presented **factually**, with the honest framing
that in a wide-area event, response is overwhelmed and delayed.

The posture is *"you are your own first responder for 72+ hours."* It is not
contempt for institutions. **Cynicism is not information.** Give the numbers and
give the realistic timeline.

### 3.6 Barter and historical claims

Barter content — what has historically held value in currency-collapse and
grid-down conditions — carries explicit caveats about **survivorship bias** in
those accounts. We report what the accounts say and we say why the accounts may
be unrepresentative.

---

## 4. Tone

Factual, dry, occasionally funny. The register is a competent friend who has
actually done this — not a doomsday marketer and not a federal pamphlet.

### 4.1 Where humor is allowed

Empty states, loading text, section intros, achievement names, locked-rung copy.

### 4.2 Where humor is forbidden

**Inside a safety instruction.** A step that can hurt someone is written flat and
plain. No wit, no voice, no flourish. This is absolute and is checked at review.

### 4.3 Fear is never a conversion mechanic

The honest pitch is that preparedness is mundane, cheap, boring, and
overwhelmingly about ordinary disruptions — a four-day outage, a boil-water
notice, a job loss, a wildfire evacuation — not the apocalypse.

Users who came for the apocalypse will stay for the competence.

### 4.4 Threat feed language rules (§4.1)

Every item carries: source name, direct link, timestamp, and a plain-language
"what this means for you" line.

- **Never editorialize.**
- **Never predict.**
- **Never aggregate separate stories into an implied narrative.**
- Show confidence. *"3 of 6 signals stale"* beats a confident number.

---

## 5. Anti-doomscroll constraints (§4.1) — hard

- **No infinite feed.** The threat view is finite, bounded, and ends.
- **Default cadence is a once-daily digest.** Real-time push is opt-in and
  reserved for life-safety alerts above a defined severity threshold (D12).
- **The "Nothing notable near you" state is a designed, first-class screen.**
  Most days it should show this. The index going green is a feature.
- An app that manufactures alarm to drive engagement is a worse product and an
  unethical one.

---

## 6. Gamification constraints (D16)

### 6.1 Governing rule

> **No mechanic may reward app usage. Every mechanic must reward real-world state.**

The scoreboard must be something the user could verify by looking in their
closet. Days of coverage is a physical quantity. Points are not.

### 6.2 Prohibited — hard

- **G01** Loss framing of any kind (*"your streak is at risk"*, *"you're falling
  behind"*, *"you're unprepared for the coming..."*)
- **G02** Fear-based nudges — direct §4.3 violation
- **G03** Leaderboards or any comparison against other users. Readiness is not
  competitive, and comparative pressure is precisely what drives panic-buying.
- **G04** Purchasable points, paid progression, or any paid advantage in the
  ladder
- **G05** Engagement notifications dressed as safety alerts
- **G06** Any score that decays from inaction alone. Food actually expiring is
  real and is shown. A number ticking down to manufacture urgency is not.
- **G07** Streaks based on app opens, sessions, or time-in-app
- **G08** Any gamification element rendered in GREY SKY state. Enforced by test.

### 6.3 Required

- Progression measured in days of coverage and ladder rungs, both derived from
  real inventory
- Achievements that require a real-world act, with evidence where practical
- Streaks limited to rotation, quarterly review, and drill cadence — all
  deliberately low-frequency
- A discovered gap is framed as a **win**: *"Good. You found that in a drill
  instead of at 3am."*

---

## 7. Commerce integrity (D14a)

**Affiliate commerce is permitted.** It was not in the first release, and the
constraints below were written before any revenue depended on them — which is
the only time such constraints can honestly be written.

Items are still described by **specification, never brand**: *"a 0.1-micron
hollow-fibre filter"*. An offer is a separate record attached to an item; it is
never the recommendation itself.

### 7.1 The four constraints, enforced as tests

1. **Ordering is computed before any commerce data is joined.** The ordering
   module imports no offer type and has no parameter through which a commission
   could reach it. This is a property of the module graph.
2. **Stripping all affiliate data leaves recommendation order byte-identical.**
   Asserted directly in `tests/unit/commerce.test.ts`.
3. **Disclosure renders adjacent to every link**, never in a page footer.
4. **Affiliate status renders as a visible badge** on the link itself.

### 7.2 The schema cannot express placement

`offerSchema` has no rank, priority, score or placement field, and strips
unknown keys. Commerce data therefore has no vocabulary in which to ask to be
moved up. A merchant cannot buy a position because there is no position to buy.

### 7.3 Non-affiliate links disclose too

A link that earns nothing says so. Silence on a non-affiliate link would train
users to read the absence of a badge as meaningless.

### 7.4 Stale offers stop linking

An offer unchecked for more than 45 days is dropped rather than shown. A dead
link or a wrong price on a preparedness list is worse than no link, and it is
the kind of rot nobody notices because the page still renders.

### 7.5 Commerce may never appear on a threat surface — hard

> **No purchase link may render on a threat, posture, exposure or Grey Sky
> surface.**

Pairing *"fuel is up 25 percent"* with a buy button is fear as a conversion
mechanic, which §4.3 forbids outright. The rule is one exported list
(`COMMERCE_FORBIDDEN_SURFACES`), the offer component refuses to render on those
surfaces even if a future call site asks it to, and the offline suite asserts
that no `[data-affiliate]` element and no `rel="sponsored"` link exists
anywhere on Today, Plan or Skills.

Suppression means **absence, not invisibility**. Hiding commerce with CSS
leaves every link in the document; this was a real bug, caught by that test.

---

## 10. Economic indicators (§4.1 supply-chain module)

Second-order analysis — how a distant event reaches a household's bills — is
explicitly in scope per §4.1's list of supply-chain and infrastructure signals.
It is also the easiest place in the product to start editorialising, so it has
the strictest schema.

### 10.1 Measured values only

An indicator carries a **current reading, a date and a baseline**. This is what
distinguishes it from a posture note (§9) and is why it may be a live signal
while a policy announcement may not: a price has a value that can fall. A news
story has no value and would only ever ratchet upward.

The age of every reading is displayed. An economic reading goes stale in weeks,
and the content gate warns past 30 days.

### 10.2 The mechanism is a chain, not a paragraph

`transmission` is a required, non-empty list of discrete links, each with a
`from`, a `to`, a stated lag and a note. A narrative paragraph is exactly the
"aggregation into an implied narrative" §4.4 forbids; a chain of labelled links
is a model the reader can inspect and disagree with one link at a time.

**Each link states where it is weaker than assumed.** Freight is 3–8% of a
grocery item's shelf price, so a 25% diesel rise is roughly 1–2% on most
groceries — not a doubling. Saying so is the difference between analysis and
alarm.

### 10.3 An exit condition is required

`wouldChangeThis` is mandatory and non-empty. An indicator with no stated way to
end is a scare, not a signal, and the schema rejects it.

### 10.4 No forecasting, no urging

The schema rejects *will, imminent, inevitable, coming war, any day now, brace,
stock up now, prepare now, skyrocket, collapse*. State what is measured, state
how it propagates, state what it costs this household. Stop there.

### 10.5 Household exposure is arithmetic, not projection

Exposure is computed from figures the user entered, against an observed
reading, as a **range** rather than a point estimate. Without those figures the
section does not render — guessing at someone's spending to produce an alarming
number would be the opposite of the point.

The headline names **which bill actually moved** rather than quoting a total,
because "almost all of this is fuel, groceries barely moved" is both calmer and
more true than a single scary number.

---

## 9. Geopolitical, defense and infrastructure news

This is the content type most likely to break §4.1 and §4.3 at once, so it has
its own rules.

### 9.1 The hard rule

> **No geopolitical, defense or policy item may change the readiness state.**

Enforced by test. The reasons are structural, not squeamish:

1. **The readiness state is about the user's locality, not the world.** §3
   defines WATCH as *something is forming* and drives a 48-hour action queue
   from that household's own gaps. A defense programme is not forming near
   anyone.
2. **Driving it from news is exactly the forbidden aggregation.** §4.1 says
   never editorialize, never predict, never aggregate separate stories into an
   implied narrative. Flipping every user in a country to WATCH on the basis of
   policy coverage *is* that narrative.
3. **It would never come back down.** Every signal in the index has a threshold
   and an expiry. A policy announcement has neither. A state that rises and
   never falls is a permanently elevated app, which is the manufactured-alarm
   failure §4.1 exists to prevent — and the thing that destroys trust when
   nothing happens for two years.

### 9.2 Where it does belong

As **standing posture**: baseline context that informs *what horizon is worth
planning for*, rendered deliberately as the opposite of an alert — no colour,
no urgency, no call to action, and an explicit line saying it does not change
the readiness state.

It may also inform which existing hazard overlay content gets surfaced first
(e.g. extended grid-down). It may raise **prominence**. It may never raise
**alarm**.

### 9.3 Epistemic status is mandatory

Every posture note declares `official`, `press-reported` or `mixed`, and any
note that is not fully official must say which part is only reported. "The
Department of Defense announced a programme" and "press reporting on internal
documents says 90 days" are different kinds of claim. An interface that renders
them identically is lying by layout.

Primary citations and press citations are stored in separate fields so the two
can never be flattened into one list.

### 9.4 No prediction, no urging

The schema rejects a posture note whose text contains predictive or urging
language — *will*, *imminent*, *inevitable*, *coming war*, *any day now*,
*brace*, *prepare now*. Caught mechanically because this is the content type
most likely to drift into forecasting, and the drift is gradual.

State what happened, state what is merely reported, state what it means for a
household, and stop.

---

## 8. Review authority and cadence

| Scope | Authority | Cadence |
|---|---|---|
| All content, v1 | Citation-bound (D09) — the cited source is the authority | Annual re-review driven by `lastReviewed` |
| `riskTier: high`, v1.1+ | Licensed professional: WFR/paramedic (medical), water-quality engineer (treatment) | Pre-launch, then annual |
| Policy changes to this file | Project owner, explicitly | On change |

**Recommended before meaningful user volume or any revenue:** paid professional
review of the high-risk tier. Personal review of uncited claims is not a gate.
