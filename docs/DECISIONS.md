# Decision Record

Scoping interview per project brief §10, completed 2026-10-29.
Every decision below is binding on implementation. Changing one is a conversation,
not a commit.

Status legend: **[CONFIRMED]** answered directly · **[DEFAULT]** no answer given,
recommended default taken per §10 ("where I don't have an opinion, use your
recommended default and tell me what you chose and why").

---

## Missing inputs

Two documents referenced by the brief were not supplied with it:

| Referenced in | Document | Status |
|---|---|---|
| §9 | Architecture notes (Netlify + Supabase, CDN-snapshot pattern, server-side proxy requirement, explicit-GRANT requirement, client-side encryption boundary) | **Not supplied.** Reconstructed from first principles in `ARCHITECTURE.md`. Treat that file as a proposal to be corrected, not as a record of your intent. |
| §7 | Source-corpus analysis (licensing tiers for the skills library) | **Not supplied.** Content sourcing proceeds on the public-domain-only basis decided in D07, which requires no licensing clearance. If the analysis surfaces licensable tiers worth buying, that is a v1.1 conversation. |

---

## Scope & audience

### D01 — v1 geography: US-only, i18n scaffolded **[CONFIRMED]**

v1 ships US-only content and data. All five live signals plus the baseline risk
profile are US federal sources: free, authoritative, no API keys, no rate-limit
negotiation.

Two things are built on day one anyway, because §8 says do not retrofit:

- Every user-facing string resolves through an i18n layer. No hardcoded English
  in components.
- The baseline-risk engine sits behind a `RiskProfileProvider` interface. FEMA
  NRI is the first implementation. Adding the UK National Risk Register later is
  a new provider class, not a schema migration.

**Architecturally material.** The provider interface is cheap now and expensive
later; it goes in before the first risk query is written.

### D02 — Beachhead: urban/suburban 72-hour person **[CONFIRMED]**

The person who just got scared by the news. Apartment or suburban house, no
land, 72-hour to two-week horizon, worried about ordinary disruption — a
four-day outage, a boil-water notice, a wildfire evacuation, a job loss.

Consequences that bind:

- Kit ladder depth goes to EDC → GHB → Bedside → Home kit → BOB. BOV and INCH
  exist in the schema and render as locked rungs, but get minimal content in v1.
- Homestead material (greywater, composting, solar siting, rainwater capture,
  root cellars, animal husbandry) is **out of v1** and becomes a paid expansion
  per D13.
- Content tone follows §6 hard: preparedness is mundane and cheap. Users who
  came for the apocalypse will stay for the competence.

### D03 — Platform: PWA only **[CONFIRMED]**

One codebase. Service worker, IndexedDB, precached shell — all native to web.
No store review in v1, which also means §5's content policy is not yet
load-bearing for distribution (it remains load-bearing for ethics and for v2).

**Known limitation, accepted:** iOS web push is unreliable for this use case.
This is the direct cause of D12 (no push in v1) — an alert channel that silently
fails for a subset of users is worse than no alert channel.

---

## Accounts & data

### D04 — No account required; anonymous local-only is the default **[CONFIRMED]**

First launch goes straight into the product. Profile, kits, gap analysis, plan
builder, skills, PDF export, threat feed — all work with no email, no signup, no
prompt.

### D05 — Sensitive tier: classify now, encrypt-sync in v2 **[CONFIRMED]**

In v1, sensitive data never leaves the device. No sync, no server row, no
exception. Sensitive means: medical needs, medications, document inventory,
duress and check-in codes, rally-point coordinates, household member ages and
names.

What ships in v1 to make v2 cheap:

- Every schema field carries a `sensitivity` classification at declaration.
- All persistence routes through a cipher interface. v1 registers the identity
  transform. v2 registers a real cipher at the same boundary.

Adding E2E sync later is then wiring a cipher into an existing seam, not
re-tiering a live database.

### D06 — Circles: print-and-share only in v1 **[CONFIRMED]**

No digital circle sharing. The §7 printable rally-point card, plan PDF, and
contact card **are** the sharing mechanism — and in a real event they are the
more reliable channel anyway.

Plans, rally points, and contacts still carry a nullable `circle_id` from the
first schema version, so v2 multi-tenancy is additive.

### D06a — Zero auth in v1 **[CONFIRMED]**

Follow-on from D04 + D05 + D06: nothing in v1 needs a user account, so v1 ships
none.

Removed from the v1 surface entirely: Supabase Auth, user tables, RLS policies
on user data, login UI, password reset, email verification, account deletion
flow, and every piece of PII that would otherwise need protecting.

Supabase's only v1 responsibility is serving read-only public data: the FEMA
National Risk Index county table and the threat-feed snapshot. Both are public
record. Neither is per-user.

**Architecturally material** — this is the single largest scope reduction in the
interview.

---

## Content

### D07 — Rewrite public-domain federal and pre-1929 sources, in our voice, with citations **[CONFIRMED]**

The brief's own default, and correct.

- US federal government works are not subject to copyright (17 U.S.C. §105):
  FEMA, CDC, EPA, USDA, NOAA, USGS, military field manuals, federal public-health
  guidance.
- US works published before 1929 are in the public domain.
- We rewrite in the §6 voice. We never republish source PDFs.
- Every skill carries source citations and a `last_reviewed` date.

No licensing clearance is required, which is why this proceeds without the
missing source-corpus analysis.

**The §5 ingestion filter is not optional here.** The commonly circulated
military-manual corpora bundle improvised-munitions handbooks, combatives,
tracking and countertracking, and urban warfare doctrine alongside the genuinely
useful survival, sanitation, navigation and first-aid manuals. Filtering happens
at the document level and fails closed on anything unclassified. See
`CONTENT_POLICY.md`.

### D08 — 40–60 deep skills in v1 **[CONFIRMED]**

Depth is the differentiator. Target distribution:

| Category | Count | Note |
|---|---|---|
| Water | 10 | Filtration and purification kept rigorously distinct — see below |
| Food | 8 | Storage, preservation, rationing, cooking without power |
| Sanitation & waste | 6 | Leading killer in grid-down; weighted accordingly, not as an afterthought |
| Heat & shelter | 6 | |
| Power | 5 | Generation and storage |
| Medical | 5 | Trained-layperson scope only, per §5 |
| Comms & navigation | 5 | |
| Psychological & decision-making | 5 | Sleep, group conflict, stress, grey man principles |

Homestead content excluded per D02.

**The water distinction is the template for the entire library.** Filtration and
purification are different operations and conflating them kills people. A DIY
sand-and-charcoal column improves clarity, sediment and taste; it does not make
water microbiologically safe. Most filters do not remove viruses. Boiling,
chemical treatment and UV are purification. Every water skill states explicitly
what it does and does not remove, and the schema enforces this with a required
`doesNotDo` field on every skill in the library — not just water ones.

### D09 — Citation-bound; no original safety guidance **[CONFIRMED]**

v1 ships no safety claim that is not traceable to a named authoritative source.
The federal agency is the authority; we are the translator.

Enforced mechanically:

- Every skill at `riskTier: high` must carry at least one citation. CI fails the
  build otherwise.
- Every skill carries `lastReviewed`. Annual re-review cadence. Staleness
  surfaces in the content admin view rather than sitting silently.
- No step may be published that cannot be sourced.

**Recommended for v1.1, not v1:** paid review of the high-risk tier by a licensed
professional — WFR or paramedic for medical, water-quality engineer for
treatment. Worth doing before meaningful user volume or any revenue.

---

## Threat feed

### D10 — Five automated government feeds + FEMA NRI baseline **[DEFAULT]**

| Source | Signal | Access |
|---|---|---|
| FEMA National Risk Index | Standing county baseline risk profile across 18 hazard types | Bulk download, self-hosted |
| NWS `api.weather.gov` | Watches, warnings, advisories by county/zone | Free, no key |
| USGS earthquake feed | Seismic events within user radius | Free, no key |
| NIFC / wildfire detections + AirNow | Active fire, perimeters, air quality | Free |
| OpenFEMA | Federal and state disaster declarations | Free |
| NOAA SWPC | Space weather, geomagnetic storms — grid and GPS risk | Free |

**The curated supply-chain and infrastructure news module is deferred to v1.1.**
Reason: of everything in §4.1, it is the only signal requiring a human editor
every single day. It is also the most differentiated thing in the feed — nobody
else does it well — so this is a deferral, not a cancellation. It ships when
there is a named owner who can curate it against §4.1's rules (never editorialize,
never predict, never aggregate separate stories into an implied narrative). An
unstaffed news feed goes stale, and a stale feed is worse than an absent one.

The FEMA NRI baseline is the spine. It is what lets the app tell a user something
true and specific on day one, before any alert has ever fired: *your county ranks
high for wildfire and drought, moderate for earthquake, very low for hurricane.*
It drives which hazard overlays appear in the kit ladder, which skills surface
first, and which live signals matter. Verify current distribution at
`hazards.fema.gov/nri` at ingest time; it is a bulk dataset and is ingested and
hosted by us, never queried live.

### D11 — Signal cards + one qualitative band; no composite number **[DEFAULT]**

The cards are the truth. Each signal renders its own state, confidence,
freshness, source name, direct link, timestamp, and a plain-language "what this
means for you" line.

Above them sits a single band: **QUIET · ELEVATED · ACTIVE · GREY SKY**, derived
by transparent rules that expand on tap.

Rejected the 0–100 composite. A number implies a model precision these inputs do
not support — the signals have different units, different update cadences and
different reliability, and averaging them into a digit manufactures confidence we
have not earned. A band is honest about being a judgment. It also gives the WATCH
state (§3) something coherent to trigger against.

Confidence is displayed, not hidden: *"3 of 6 signals stale"* is more useful than
a confident number.

### D12 — No push notifications in v1 **[DEFAULT]**

Build order puts notifications last (step 8) and that is correct. v1 ships the
once-daily in-app digest and a well-designed **"Nothing notable near you"** state.
Most days should show exactly that. The index going green is a feature.

Compounding reason: D03 chose PWA-only, and iOS web push would fail silently for
a meaningful share of users. A life-safety alert channel that works for some
people and not others, with no way for the user to know which group they are in,
is worse than none.

When push does ship, the gate is hardcoded and narrow: NWS severity Extreme or
Severe, AND urgency Immediate, AND an event type on an explicit allowlist
(tornado warning, flash flood warning, evacuation order, tsunami warning).
Nothing else ever pushes. No index changes, no digests, no news, no
re-engagement, ever.

---

## Business

### D13 — Every life-safety feature free, permanently **[CONFIRMED]**

**Free forever, no account, no limits:** the full skills library, every kit
ladder rung, gap analysis, days-of-coverage, the plan builder, every PDF export
(plan, rally card, contact card, supply checklist, individual skill pages), the
threat feed, achievements, and drills.

**Paid:** cross-device sync, circles, barcode scanning at volume, bulk CSV/JSON
import-export, drill history and analytics, and the homestead planning suite.

The paywall sits on convenience and the power-user surface. It never sits on
something that keeps a person alive. PDF export specifically stays free despite
§13 naming export bundles as a monetization lane, because §7 calls paper the last
backup and instructs us to prompt printing during onboarding — charging for it
would contradict the product's own safety argument. Only bulk and batch export
is paid.

### D14 — No affiliate commerce in v1 **[CONFIRMED]**

v1 recommends items by **category and specification**, never by brand or SKU:
*"a 0.1-micron hollow-fiber filter"*, not a product link. There is nothing to
monetize and therefore nothing to distort.

The recommendation ordering function is driven purely by marginal survival value
per dollar (§4.2 cost tiers) and is architecturally sealed from any commerce
layer added later: commerce data may only be joined *after* ordering is computed.

If affiliate is ever added, these are non-negotiable and are encoded as tests:

1. Ordering is computed before any commerce data is joined.
2. Stripping all affiliate data leaves recommendation order byte-identical.
3. Disclosure renders adjacent to every affiliate link, not in a footer.
4. Affiliate status is a visible badge on the item.

§14 is right that retrofitting integrity is impossible. These constraints exist
now, while they are free.

### D15 — Brand: pressure-tested, **Ballast** recommended **[CONFIRMED — awaiting final sign-off]**

Full findings in `BRAND.md`. Summary:

| Candidate | Finding | Verdict |
|---|---|---|
| **Ballast** | No app of that name on either store. Existing marks abandoned or unrelated. Nothing in Class 9 preparedness. | **Recommended** |
| Hardtack | One pending Class 9 app filing (ser. 99830117, May 2026), unexamined, different field | Viable alternate |
| Mainstay | Mainstay Labs holds a registered Class 36+42 software mark (Dec 2025) | Dropped |
| Groundwork | GroundWork Open Source holds a Class 9 monitoring-software mark | Dropped |
| *Black Sky* (brief's name) | BlackSky Technology (NYSE: BKSY) is a live satellite-imagery company; "black sky hazard" is EIS Council's coined term of art for this exact domain | **Avoid** |

Until sign-off, the name lives in a single brand config file. Changing it is one
commit. The readiness states (BLUE SKY / WATCH / GREY SKY) are unaffected either
way — they name conditions, not the product.

Caveat recorded honestly: the above is aggregator research (Justia, GleanMark),
not USPTO TSDR. A real clearance search by a trademark attorney is required
before any spend on identity design.

---

## Gamification

Requested mid-interview and scoped as **D16**.

### Governing rule

> **No mechanic may reward app usage. Every mechanic must reward real-world state.**

This is the same argument as §4.1's anti-doomscroll constraint. An app that
awards points for opening it is optimizing a proxy. The scoreboard here must be
something the user could verify by looking in their closet.

### D16 — v1 scope: ladder + days-of-coverage + achievements. Drills in v1.1. **[CONFIRMED]**

**In v1** (ships with the supply system, because it largely *is* the supply
system rendered honestly):

1. **The kit ladder as progression.** EDC → GHB → Bedside → Home → BOB → BOV →
   INCH. A rung completes at 80% of its items with all critical items present —
   not 100%, because perfectionism kills retention. Locked rungs stay visible and
   greyed: *"You don't need an INCH bag. You need a water filter."* This is also
   the onboarding sequence, which is what solves the beginner-overwhelm problem
   that kills retention in this category.

2. **Days of coverage as the score.** Not points. Water: 4 days. Calories: 11
   days. Heat, power, sanitation likewise. A physical, verifiable quantity that
   rises when the user actually buys water. Per §4.2 this single sentence is the
   app's most important UI element.

3. **Named readiness tiers** mapped to real doctrine rather than invented levels:
   **Unprepared → 72-Hour → Two-Week → One-Month → Season.** Reaching 72-Hour is
   a genuine milestone and is celebrated as one.

4. **Achievements requiring real acts**, never taps. *Paper Trail* (printed the
   plan). *Cold Start* (used the app in airplane mode — the user verifying our
   core claim). *Carry It* (walked a mile with the GHB, logged weight and time).
   *Under Budget* (BOB below the bodyweight threshold). *Out-of-Area* (added the
   contact everyone forgets). *Fifty Dollars In* (completed the $50 tier).
   *Boring Competence* (90 days, nothing expired, plan reviewed).

5. **Honest streaks only.** Rotation streak (months with zero expired items),
   review streak (quarterly), drill cadence (quarterly). Deliberately
   low-frequency. An app that wants daily engagement from a preparedness user is
   lying about what preparedness is.

6. **Read ≠ practiced.** Skills track both; only *practiced* counts toward
   progression. *"You've read 14 water skills and practiced 2. Reading is not a
   filter."*

**In v1.1 — drills.** The most differentiated mechanic in the design, deferred
only because it needs its own logging UI, timers, photo evidence and the
gap-to-shopping-list pipeline, and that should not delay proving airplane mode.
Water Shutoff Drill (timed, photograph it). Blackout Drill (two hours, breaker
off — what failed?). Grab Bag Drill (90 seconds out the door). Dead Phone Drill
(execute the plan from the printed card alone). Each carries a time target, a
log, and the gaps it discovered, which flow directly into the shopping list.

A failed drill is the single most valuable artifact the app can produce:
*"Good. You found that in a drill instead of at 3am."*

### Grey Sky suppression — hard rule

In GREY SKY state every badge, score, streak, tier and celebration is hidden.
§3 says four things only: MY PLAN · WATER · SHELTER/HEAT · CONTACT. Nobody needs
confetti during a tornado. This is enforced by test, not by convention.

### Prohibited mechanics

Encoded as policy in `CONTENT_POLICY.md`:

- No loss framing (*"your streak is at risk"*, *"you're unprepared for..."*)
- No fear-based nudges of any kind — direct §6 violation
- No leaderboards or comparison against other users. Readiness is not
  competitive, and comparative pressure is precisely what drives panic-buying.
- No purchasable points or paid progression
- No engagement notification dressed as a safety alert
- No score that decays from inaction alone. Food actually expiring is real. A
  number ticking down to create urgency is manufactured anxiety.

### Schema added

`drills`, `drill_gaps`, `achievements`, `skill_progress`, and
`readiness_snapshots` — the last being the retention engine, since it lets the
app show a curve of real numbers over time: *you were at 2 days in March, you're
at 11 now.*

---

## Standing posture

### D17 — Geopolitical and defense news informs the horizon, never the state **[CONFIRMED]**

Raised by the request to factor current world events, including the Pentagon's
FORTRESS America programme, into the readiness state.

**Considered, and declined for the state.** FORTRESS America is real: announced
30 September 2026 at Marine Corps Base Quantico, standing for Federal
Operations for Resilience, Troop Resources, Energy, Supply and Survivability,
across five pillars and roughly 500 continental US installations. The widely
quoted 90-day self-sufficiency figure comes from press reporting on internal
planning documents; no public directive confirming it has been released.

It does not drive the readiness state, for three reasons recorded in
`CONTENT_POLICY.md` §9: the state is local and this is not, driving it from
policy coverage is precisely the aggregation §4.1 forbids, and a state raised
by a policy announcement has no threshold that would ever bring it back down.

**Built instead: standing posture.** A new content type with its own schema,
validation and citation gate. Baseline context, rendered as the opposite of an
alert, carrying an explicit epistemic status and keeping primary and press
citations in separate fields. The schema rejects predictive or urging language
outright.

The useful content of the request survives intact, and arguably lands harder:
the app now shows the user's own target horizon beside the reported
institutional one — **3 days against 90** — and says plainly that nothing needs
doing today. Read flat, FORTRESS is the Pentagon doing for its bases what this
app asks households to do, which is an argument for the product's thesis rather
than evidence of an imminent event. That is a stronger and more honest pitch
than an elevated threat level, and it does not expire.

If you want geopolitics in the state machine anyway, the defensible form is a
**manual** user-set state — which already exists — never an automatic inference.

---

## Build order

Per §11, unchanged. The threat feed is the most fun and the least load-bearing,
and is not built first.

| # | Step | Status |
|---|---|---|
| 1 | Content schema, content pack format, offline shell. **Prove airplane mode.** | In progress |
| 2 | Supply system with gap analysis + ladder/coverage/achievements (D16) | Pending |
| 3 | Plan builder + PDF export | Pending |
| 4 | Skills library rendering and local full-text search | Pending |
| 5 | Readiness-state machine and Grey Sky interface | Pending |
| 6 | ~~Auth~~, encrypted sync, circles — *auth deferred entirely per D06a* | v2 |
| 7 | Threat feed ingestion, CDN snapshot pipeline, Threat Index | Pending |
| 8 | Notifications | v1.1+ per D12 |

Steps 1–4 ship as a complete, genuinely useful offline product before any network
feature exists. If the app is not valuable with the radio off, no amount of live
data fixes it.
