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

## 7. Commerce integrity (D14)

No affiliate commerce in v1. Items are recommended by **category and
specification**, never brand or SKU.

If affiliate is ever introduced, these are enforced as tests, not promises:

1. Recommendation ordering is computed **before** any commerce data is joined
2. Stripping all affiliate data leaves recommendation order **byte-identical**
3. Disclosure renders **adjacent to** every affiliate link, never in a footer
4. Affiliate status renders as a **visible badge** on the item

§14 is right: retrofitting integrity is impossible. These constraints are
written now, while they cost nothing.

---

## 8. Review authority and cadence

| Scope | Authority | Cadence |
|---|---|---|
| All content, v1 | Citation-bound (D09) — the cited source is the authority | Annual re-review driven by `lastReviewed` |
| `riskTier: high`, v1.1+ | Licensed professional: WFR/paramedic (medical), water-quality engineer (treatment) | Pre-launch, then annual |
| Policy changes to this file | Project owner, explicitly | On change |

**Recommended before meaningful user volume or any revenue:** paid professional
review of the high-risk tier. Personal review of uncited claims is not a gate.
