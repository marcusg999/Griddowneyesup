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

### D08 — 40–60 deep skills in v1 **[CONFIRMED — 50 written]**

Depth is the differentiator. Target distribution, and what was written:

| Category | Target | Written | Note |
|---|---|---|---|
| Water | 10 | **10** | Filtration and purification kept rigorously distinct — see below |
| Food | 8 | **8** | Storage, outage safety, rationing, cooking without power, home canning |
| Sanitation & waste | 6 | **6** | Leading killer in grid-down; weighted accordingly, not as an afterthought |
| Heat & shelter | 6 | **6** | The carbon-monoxide cluster. Highest fatality density in the library |
| Power | 5 | **5** | Generation, storage, and the backfeed hazard |
| Medical | 5 | **5** | Trained-layperson scope only, per §5. No dosing guidance anywhere |
| Comms & navigation | 5 | **5** | |
| Psychological & decision-making | 5 | **5** | Sleep, group conflict, children, not being the interesting one |
| **Total** | **50** | **50** | 28 at `riskTier: high`, 127 citations, all public-domain federal |

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

### D20 — The digest ships client-first, against signed sample snapshots **[DEFAULT]**

Step 7 has two halves: a pipeline that ingests the six D10 sources and
publishes a snapshot, and a client that reads one. They were built in that
order reversed, deliberately.

The client half is the half that can break the product's premise. It is the
only part of the app that wants a network, and §2's promise is that no render
path ever waits for one. Building it first, against snapshots published in the
real shape at the real paths with real signatures, means the read path, the
timeout, the verification, the staleness rules and the band are all exercised
against the genuine article rather than against a mock that agrees with
whatever the client expects.

The sample snapshots are generated by `scripts/build-snapshots.ts`, which is a
stand-in for the ingester and nothing more. Replacing it is the only change
needed to go live; nothing downstream knows the difference except the
provenance flag.

Signal ages in the fixtures are relative and stamped at build time. Fixed
timestamps would read as permanently stale, which would make the staleness
rules untestable in the app and the demo quietly misleading.

### D21 — A sample digest is marked as such and may not move the state **[DEFAULT]**

Every published snapshot carries `provenance: 'live' | 'sample'`, and the
interface renders an unmissable notice on anything marked sample.

This is deliberately NOT folded into `EpistemicStatus`. That type's three
values — `official`, `press-reported`, `mixed` — all assert that the
underlying thing happened. A sample digest asserts nothing, and labelling
fabricated signals `official` would be the single most damaging thing this
surface could do: it means "traceable to a published government source".

A sample digest also never suggests a readiness state, however active its band
looks. Nudging someone toward WATCH on the strength of illustrative data would
be a false alarm the product manufactured from its own fixtures, which is a
worse failure than missing a real one — it is the mechanism §4.3 forbids,
pointed at ourselves.

### D22 — GREY SKY is a declaration, never an inference **[DEFAULT]**

D11 lists the band as QUIET · ELEVATED · ACTIVE · GREY SKY. The derivation
implements the first three only.

Grey Sky strips the interface to four things. Reaching that state is the user's
declaration that it is happening — or, later, D12's deliberately narrow
life-safety gate. It is not something a once-daily digest may conclude. A
digest that can strip the interface off the back of a stale or wrong feed will
eventually do it wrongly, and the cost of being wrong in that direction is the
whole product: a user who has learned the app panics at nothing is a user who
ignores it on the day it is right.

The strongest thing the derivation does is set `suggests: 'watch'`, which the
interface offers and the user accepts.

### D23 — A stale signal does not raise the band, and says so **[DEFAULT]**

Freshness windows are per source rather than one global figure, because the
cadences genuinely differ: an NWS warning is a matter of minutes to an hour,
while a federal disaster declaration is good for days.

A signal past its window keeps its card, its level and its age — nothing is
hidden — but it does not count toward the band, and the confidence line names
how many sources are stale. Treating a six-hour-old tornado warning as current
would be manufacturing alarm from a record that has almost certainly expired.

---

### D24 — Pull when the network returns, not only when the app opens **[DEFAULT]**

Both fetch paths ran once on mount and never again. A phone that walked back
into WiFi, or found a bar of signal on the way home, kept showing whatever it
read hours earlier until somebody thought to close and reopen the app. Nobody
thinks to do that, least of all on the day it matters.

Two triggers now, because neither alone is enough: the `online` event, and a
backgrounded tab becoming visible — `online` firing while the page is suspended
is exactly the event a sleeping phone misses.

Guarded per region rather than with a single in-flight flag. The profile loads
after first render, so the region goes `default` to the user's county with the
first fetch still outstanding, and a bare flag makes the second refresh return
early and never fetch at all. The offline suite caught that regression; it was
introduced and found inside the same change.

### D25 — The digest may carry world context, and a sample digest may not **[DEFAULT]**

Standing posture (§9) and economic indicators (§10) shipped inside the content
pack, which froze them at build time: the Strait of Hormuz could reopen and the
app would keep saying it was shut until somebody cut a release. Baseline
context measured in months still changes, and a stale claim about the world is
worse than no claim.

A digest may now carry both, and what it carries wins by id. The pack is the
floor — what the app knows with no network, forever — and the digest is the
correction on top. By id rather than wholesale, so a publisher that reached
four of six sources can correct the two it has without silently dropping the
rest.

A SAMPLE digest contributes none of it, enforced in two places: the client
ignores world context from a sample digest, and the publisher refuses to emit
it. A fabricated signal is bad enough. A fabricated posture note is a claim
about a government's actions wearing an epistemic status that means "traceable
to a published government source" (D21).

This is NOT the curated news module. D10 deferred that pending a named owner
who can curate it daily against §4.1, and that reasoning is unchanged: an
unstaffed news feed goes stale, and a stale feed is worse than an absent one.

### D26 — "Last synced" means this device reached the network **[DEFAULT]**

The status bar said "Never synced. Everything here still works." unconditionally
— true on day one, a lie from the first refresh onwards. The second half stayed
true throughout, which is probably why nobody noticed the first half had
stopped being.

It now reports the last time a fetch actually landed, recorded centrally by
both fetch paths and broadcast so the bar updates when a background refresh
succeeds. Deliberately not the digest's publish date, which is a fact about the
publisher rather than about this device: a phone that has been in a basement
for two days should say so even if the digest it holds was cut an hour before
it went down there.

Recorded when the fetch verifies, not when it writes. Reaching the network and
finding nothing new is still a successful sync.

---

### D27 — The release gate runs on bytes we control, and the live ingest happens after it **[DEFAULT]**

The ingester was wired into the Pages pipeline before the gate, so by the time
the offline suite ran, the sample digests it asserts against had been replaced
with whatever the real world was doing. The suite checks that the digest is
marked `sample`, that the 06075 fixture's band reads ACTIVE, and that a
30-hour-old reading is reported as outside its freshness window. Live data
satisfies none of those on a quiet day and some of them on a loud one, so the
gate's verdict tracked the weather in California. That is not a gate.

The order is now: build the samples, prove the client against them, then fetch
the live sources and publish those over the top, then rebuild and deploy. The
live bytes are different bytes signed after the gate ran, and they are the ones
users fetch, so the signature test runs again against them before deploy.

The same mistake in a second form: the suite's allow-list of source hosts was
anchored on `weather.` and the real NWS link is `alerts.weather.gov`, so a
pattern that claimed to permit NWS rejected it. It now matches by domain, and
the fixtures cite the URLs the collectors actually emit — a fixture that cannot
occur in production tests a shape production never produces.

---

### D28 — News may feed the brief, but only behind a publisher allow-list **[CONFIRMED]**

ReliefWeb was the only source carrying unrest and conflict — every other feed
is US disaster or weather. Its v1 is retired and its v2 refuses an
unregistered caller, so the category the brief was asked for first went dark.

GDELT replaces it. GDELT needs no key and indexes world news in near real
time, and that is both why it works and why it is dangerous: an unfiltered
query returns aggregator reprints, content farms and partisan outlets
alongside the wires, attributed to a bare domain. §5 says this must never
become a news app. §4.4 requires a named publisher and a canonical link.
Unfiltered GDELT fails both.

So the admissibility condition is an allow-list of publishers, enforced in the
collector. A domain not on the list is **dropped**, not down-ranked. The list
is wire services first and then outlets with a standing foreign desk and a
published corrections policy; its value is what it leaves out. Matching is on
a label boundary, so `reuters.com.evil.net` is not Reuters.

Three further constraints, each a test:

- Everything is `press-reported`. Never `official`. These are reports about
  events, not primary documents.
- GDELT never produces a signal. Unrest elsewhere does not move a household's
  readiness state, and wiring a news feed into the band would be the fastest
  way to make the band meaningless (D11, D21).
- Three items per category, deduplicated by headline. The feed ends.

Category comes from which query found an item, not from a regex over its
headline, so it is a fact rather than a guess. ReliefWeb stays wired: if an
appname is ever registered it comes back on its own, and two overlapping
sources beats the category going dark again.

---

### D29 — The horizon is a dial, and it shows its bill **[DEFAULT]**

`targetHorizonDays` existed in the profile from the start and nothing could
change it. Three days was effectively hard-coded, which made the posture
note's argument — that institutions plan in months while households are told
seventy-two hours — rhetoric the app could state but not act on.

The dial offers 3, 7, 21, 30, 60 and 90. Not a free-text field: "47 days" is
not a number anyone can plan against. A profile carrying some other value is
snapped to the nearest, and ties round **up**, because rounding fourteen down
to seven would quietly halve somebody's target.

Changing it re-runs the same maths on the same shelf and reports the result as
things to buy, what they weigh and roughly what they cost — not a percentage.
A percentage is a feeling; four containers and eight kilograms is a fact a
household can act on or decide against. Deliberately not reassuring: the
weight is not rounded down, the cost is not hidden, and when only some lines
have a typical price the partial total says so rather than passing for the
whole.

One item per gap, ordered by value per dollar and nothing else, which is the
same rule every other recommendation in the app follows (§7, D14). A gap
closed by seven different products is a shopping list nobody follows. Where
the catalogue provides nothing for a resource, the row says so instead of
inventing a suggestion.

It lives on the acquisition surface and is absent in Grey Sky, by absence and
not by hiding: planning a ninety-day shop is not a Grey Sky activity.

---

### D30 — The fuller feed comes from more real sources, never from written fixtures **[CONFIRMED]**

Asked to fill the sample digest with stories about El Nino, military mass-grave
drills, wars and protests. Refused the literal form and did the underlying
thing instead, because the literal form breaks the app at its foundation.

Every brief item carries an `epistemicStatus` meaning "traceable to a published
source" and a mandatory live link to *that item*. A written item has no such
link, so it ships either a dead URL or a real URL that does not support the
claim. Invented claims about a real military digging mass graves are
disinformation whatever label sits above them, and the sample notice is not a
label a reader carries in their head once the words are in. A frozen real item
is no better: it goes stale on a phone that sat for four months, and a stale
claim about a war is worse than none — which is already why the pack ships no
brief items at all.

What the request actually wanted was a Worth-knowing surface with substance on
it. Three real things deliver that:

- **A posture note on ENSO.** El Nino is a standing signal measured in seasons,
  not a dated event, so it belongs in posture (§9) rather than the brief. Real,
  official, cited to NOAA's own index.
- **A posture note on mass-fatality planning.** The documented part — FEMA's
  fatality-management planning factor, Army contingency-interment doctrine —
  goes in `whatItIs` with primary citations. The October 2026 exercise
  reporting goes in `reported`, flagged unverified, and is *not* given press
  citations: the outlets carrying it would not clear the publisher allow-list
  this app applies to GDELT, and citing them here while rejecting them there
  would be a double standard. The household takeaway is the paperwork the plan
  builder already produces, not mortality.
- **GDACS**, so disasters and severe weather are worldwide rather than one
  country's. `official`: an intergovernmental alerting system issuing its own
  assessments, unlike the news aggregators here.

Posture notes ship in the signed pack and render offline, so this makes the
surface fuller with no network and no invention. Wars and protests stay empty
until a real source is reachable, and the surface says so rather than filling
the hole with prose.

The ENSO collector exists for the staleness problem rather than for alerting:
a baked-in claim about the climate is wrong four months later, so the digest
recomputes the note under the pack's own id and corrects it in place. It
applies NOAA's published rule — the index at or beyond ±0.5 for five
consecutive overlapping seasons — rather than a threshold of our own, and four
seasons past the threshold is reported as neutral, because calling it an event
early would be forecasting.

---

### D31 — The confidence denominator is what the publisher tried **[DEFAULT]**

"4 of 6 signals reporting" was wrong in both numbers, and the two errors hid
each other.

The denominator was a constant, `SIGNAL_SOURCE_COUNT = 6`, taken from D10's
six sources. But one of the six is the FEMA National Risk Index, which this
codebase's own type comment describes as a standing county baseline that is
"deliberately NOT a signal". So six was a total that could never be reached.
The numerator then added one — with a comment explaining that the NRI "is
always available: it ships in the content pack" — to compensate. A padded
numerator over an unreachable denominator produced a plausible-looking
fraction that described nothing.

Worse, a source with no collector at all was indistinguishable from one that
was down. AirNow had been in the signal union and the fixtures since step 7
with nothing fetching it, so every live digest silently reported one fewer
source than it claimed, and the surface gave no hint which one or why.

Three changes, which are one idea:

- The digest carries `attempted`: the signal sources the publisher actually
  tried for that region. That is the denominator. Optional, so a digest cut
  before this field falls back to the constant rather than claiming zero.
- The numerator is signals present and fresh. No baseline padding.
- `unreachable` is finally read. The confidence line names the sources that
  failed, by publisher name rather than internal id: "FEMA declarations could
  not be reached", not a quietly smaller fraction. Brief and posture sources
  are excluded from that list — ReliefWeb, GDELT, GDACS and ENSO can be down
  too, but they were never part of "signals reporting" and listing them would
  make the county's own picture look worse than it is.

A source not attempted is not a gap. AirNow needs a key, which is read from
the environment and never committed; without one the source is skipped, so it
leaves the denominator rather than appearing as a failure the reader can do
nothing about.

---

### D32 — The game is the binding constraint, priced in days **[CONFIRMED]**

Asked whether the app could be truly gamified, since gathering supplies was
neither clear nor engaging. D16 rules out the obvious answers: no mechanic may
reward app usage, and a score that rises because somebody opened a screen
measures the wrong thing. So no points, no streaks, no levels, nothing to
collect, and no leaderboard (G01, G03).

What was left turned out to be better, and it was already in the data.
Coverage is measured in days. Every catalogue item states what it provides per
unit and what it typically costs. Divide one by the other and you get the only
sentence that has ever made anybody buy a water container:

> **$25 and two kilograms takes you from four days to eleven.**

That is a complete loop. A score nobody can fake, because it is a physical
quantity in a cupboard. One clear move, because the binding constraint picks
it. A visible payoff in the same units as the score. And a named goal, because
the tiers are real doctrine — 72 hours, two weeks, a month, a season — rather
than invented levels.

Three deliberate properties:

- **One item, not a list.** The acquisition tiers already answer "what should I
  buy in total". This answers "what do I do now", and its whole value is that
  the answer is one thing a person can act on today.
- **The household figure is stated separately from the resource figure**, and
  the card names what becomes the limit next. "You fixed water and now food
  binds" is the single most useful idea in household preparedness, and watching
  it happen teaches it better than being told would.
- **The payoff is computed, not asserted.** The coverage is recalculated with
  the new stock in place, so when the household number does not move as far as
  the resource does, the card says so instead of flattering the purchase.

Where the catalogue cannot serve the binding resource, the card renders
nothing rather than offering the next-best resource: pointing a household away
from its actual constraint is worse than an empty space.

Achievements stay what they were — acknowledgements of things that already
happened, not goals. The goal is the next milestone, which is stated as a
countdown in days.

Instructions are four steps in a `details` element, open while the shelf is
empty and collapsed once it is not. Deliberately not a dismissible tour: a
tour needs a "seen it" flag, that flag is exactly the state that does not
survive clearing site data, and the moment a person most needs instructions is
the moment after they have lost everything.

---

### D14a — Affiliate commerce permitted **[CONFIRMED — reverses D14]**

Decided after the first release. §14 said to decide it up front precisely
because "retrofitting integrity is impossible"; the constraints below were
written before any revenue depended on them, which is the only time they can
honestly be written, and they are now enforced as tests rather than promises.

- Ordering is computed before commerce is joined — the ordering module cannot
  import an offer type, so this is a property of the module graph.
- Removing every offer leaves recommendation order byte-identical. Asserted.
- `offerSchema` has no rank, priority or placement field and strips unknown
  keys: there is no position for a merchant to buy.
- Disclosure adjacent to every link, badge on the link, and non-affiliate links
  disclose that they earn nothing.
- Offers unchecked for 45 days stop linking.
- **No purchase link may appear on a threat, posture, exposure or Grey Sky
  surface.** Pairing a price shock with a buy button is fear as a conversion
  mechanic. Suppression is absence, not CSS invisibility.

Full detail in `CONTENT_POLICY.md` §7.

### D19 — Economic exposure module **[CONFIRMED]**

The §4.1 supply-chain signal, built. It ships the honest version of
second-order threat analysis: observed readings with dates and sources, a
transmission chain of discrete inspectable links rather than a narrative, and
arithmetic on the household's own figures expressed as a range.

It does **not** change the readiness state, and D17's reasoning survives
intact — but it refines it. The reason a policy announcement may not be a live
signal is that it has no current value and no threshold, so it could only
ratchet upward. A price has both. An indicator can fall, and when it does the
exposure falls with it. That is what makes it a signal rather than a scare.

The first indicator set covers retail diesel and Brent crude against the
Hormuz disruption. Note what the analysis actually concludes: freight is 3–8%
of a grocery item's shelf price, so a 25% diesel rise is roughly 1–2% on most
groceries. The honest finding is that the household's fuel bill moved and its
grocery bill barely did — which is more useful, and considerably calmer, than
the headline.

### ~~D14 — No affiliate commerce in v1~~ **[SUPERSEDED by D14a]**

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

### D16a — Standing achievements are live, milestones are permanent

Added while building D16's achievement set.

A badge claiming "Nothing Expired" rendered above a rotation queue listing
expired bleach, because the award rule made everything sticky. G06 protects a
score from decaying to manufacture urgency; it does not protect a false claim
about the present, and it already carves out food expiring as real.

So achievements split. **Milestones** (72 Hours, Two Weeks, Fifty Dollars In,
Paper Trail, Cold Start, Out of Area, Shutoff Certified, Boring Competence)
record that something happened and are kept forever. **Standing** achievements
(Nothing Expired, Under Budget) describe current state, are computed live,
are never persisted, and disappear when they stop being true.

They render under separate headings — "True today" and "Done" — so a claim
about now is never mistaken for a record of the past.

### D16b — What actually binds the readiness tier

Found by a failing achievement test. `limitingDays` took the minimum across
every resource with a daily need, which let **power** zero out the tier: a
household with thirty days of water, food and sanitation but no power bank
read as zero days prepared.

That is misleading in the pessimistic direction, which is its own kind of
dishonesty, and it makes the headline number feel unreachable rather than
useful — the opposite of what §4.2 wants it to do.

Water, calories and **sanitation** always bind; sanitation because the brief
is right that it is the leading cause of illness in a prolonged outage and the
thing households plan for least. **Heat** binds only where the household's own
hazards include winter storm or extended grid-down. **Power never binds** —
it is shown, it matters, and it does not decide whether you are prepared.

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

## Paper

### D18 — Printable documents use the browser print pipeline, not a bundled PDF library **[CONFIRMED]**

Reasoning in `ARCHITECTURE.md` §12. In short: §7's goal is ink on paper, not a
file; the browser pipeline costs 0 KB against a 150 KB budget, produces
selectable and screen-readable text at the user's own paper size, works offline
inherently, and still offers "Save as PDF" on every platform. A bundled
renderer would spend a third of the performance budget to produce a worse
document.

Five documents ship: household plan, wallet-sized rally card (four to a sheet,
because a household is rarely one person), contact card with blanks for local
numbers, supply checklist, and any individual skill page.

If a true file download is wanted later — emailing a plan to a relative — it
can be added as a lazily loaded chunk without disturbing any of this.

---

## Build order

Per §11, unchanged. The threat feed is the most fun and the least load-bearing,
and is not built first.

| # | Step | Status |
|---|---|---|
| 1 | Content schema, content pack format, offline shell. **Prove airplane mode.** | In progress |
| 2 | Supply system with gap analysis + ladder/coverage/achievements (D16) | Ladder, coverage, weight budgeting done; achievements and rotation pending |
| 3 | Plan builder + PDF export | **Done** |
| 4 | Skills library rendering and local full-text search | Pending |
| 5 | Readiness-state machine and Grey Sky interface | Pending |
| 6 | ~~Auth~~, encrypted sync, circles — *auth deferred entirely per D06a* | v2 |
| 7 | Threat feed ingestion, CDN snapshot pipeline, Threat Index | Pending |
| 8 | Notifications | v1.1+ per D12 |

Steps 1–4 ship as a complete, genuinely useful offline product before any network
feature exists. If the app is not valuable with the radio off, no amount of live
data fixes it.
