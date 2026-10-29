# Brand Pressure-Test

Per brief §10 Q15. Research conducted 2026-10-29.

**Recommendation: Ballast.**

---

## Caveat, stated up front

This research used public trademark aggregators (Justia, GleanMark), app-store
search, and general web search. It is **not** a USPTO TSDR clearance search and
is **not** legal advice.

A real clearance search by a trademark attorney is required before any spend on
identity design, domain acquisition, or store registration. Treat what follows as
triage that eliminates obviously-blocked names cheaply — not as a green light.

---

## The brief's name: Black Sky — two serious collisions

### Collision 1: BlackSky Technology (NYSE: BKSY)

A live, publicly traded company. Herndon, Virginia. Operates a low-earth-orbit
smallsat constellation and an AI analytics platform called Spectra, selling
imagery and analytics to government, defense and commercial customers.
FY2024 revenue $102.1M, up from $94.5M. Market cap reported between $835M and
$1.06B depending on source and date.

This is a well-capitalized incumbent with an obvious interest in the name, in an
adjacent domain (geospatial situational awareness), with the resources to oppose.

### Collision 2: "black sky hazard" is a term of art

The EIS Council coined and popularized "black sky hazard" to mean *a catastrophic
event that severely disrupts the normal functioning of critical infrastructure in
multiple regions, for long durations* — triggered by cyberattack, geomagnetic
disturbance, or high-altitude EMP.

The term is in active institutional use: Pennsylvania PUC ran a "Black Sky
Exercise" with EIS Council in 2016; Imperial College has run "Societal Resilience
to Black Sky Hazards" events; it appears in US House committee testimony and in
grid-resilience industry conferences.

**Why this is the worse of the two problems.** A descriptive term of art in your
own domain is hard to register and hard to own. You would be naming a
grid-resilience app after the grid-resilience industry's generic phrase for the
event. Store search would return industry whitepapers and conference listings,
not you.

**Verdict: avoid.**

---

## Candidates tested

### ✅ Ballast — recommended

**Meaning.** Nautical ballast is weight carried low in a hull to keep a vessel
upright in heavy weather. You do not fight the storm. You are simply hard to
capsize.

That is exactly the §6 posture: preparedness as mundane competence rather than
apocalypse theater. The metaphor does the positioning work without a tagline.

**Collision research.**

| Check | Result |
|---|---|
| App Store / Play, preparedness category | No app found by that name |
| `BALLASTWATCH` (ser. 76620789) | Class 9, but covers ballast-water treatment reporting for ships. **Abandoned 2006** |
| `BAAS BALLAST AS A SERVICE` (ser. 79407275) | Class 9 software, but pet-related. **Abandoned**, latest event 2026-04-09 |
| `THE OFFICIAL BALLAST OF THE NEW MILLENIUM` | Class 9, status unclear, plainly unrelated field |
| Class 9 preparedness software named Ballast | **None found** |

**Mark strength.** "Ballast" applied to preparedness software is *arbitrary* —
the word has no descriptive relationship to the goods. Arbitrary marks are the
second-strongest category after coined ones, and are meaningfully easier to
register and defend than suggestive or descriptive marks.

**Practical properties.**

- 7 characters — fits an app icon label without truncation
- Two syllables, spelled correctly on first hearing
- No awkward abbreviation needed
- Not apocalypse-coded, which §6 explicitly requires
- Compatible with the existing readiness-state vocabulary: BLUE SKY / WATCH /
  GREY SKY name conditions, not the product, so they survive the rename intact

**Weakness, stated honestly.** Carries zero ASO keywords. This is acceptable and
normal — the App Store subtitle and keyword field carry discoverability
("Offline emergency preparedness"), not the name. Naming for ASO produces
forgettable names.

---

### ◐ Hardtack — viable alternate

Ship's biscuit; the food that outlasts everything. Distinctive, memorable, and
quietly funny in a way that fits the §6 register.

**Collision:** one pending US application, serial 99830117, filed 2026-05-18,
awaiting examiner assignment. Covers mobile app software for field-service
business operations (dispatch, routing, work orders, time tracking) plus AI
conversation and summarization software.

Same class, same broad goods description ("mobile app software"), different
industry. Unexamined and therefore unresolved. A real clearance search could find
it coexistable, or not.

**Secondary concern:** reads slightly martial and slightly grim. Less aligned
with §6's anti-apocalypse tone than Ballast.

---

### ✗ Mainstay — dropped

A mainstay is the rigging that holds the mast up, and colloquially the thing you
rely on. Excellent meaning. Blocked in practice.

- **Mainstay Labs Inc.** (San Francisco) holds a combined Class 36 + 42 mark
  **registered 2025-12-23**, with software coverage. Also a pending Class 36
  filing from 2025-09-25.
- **Mainstay** student-engagement chatbot platform — separate company, widely
  deployed in higher education.
- **Mainstay Software Corp** — government procurement software.
- A September 2026 acquisition announcement for a real-estate SaaS named Mainstay.

A live registered software mark plus three unrelated companies using the name
commercially. Too crowded.

---

### ✗ Groundwork — dropped

The preparation you do before anything is built. On-message for §6. Occupied.

- **GroundWork Open Source, Inc.** holds a Class 9 mark for network and
  application monitoring software, plus related consulting marks.
- **GROUNDWORK MONITOR** (ser. 97153812) pending, covering monitoring software
  and consulting.
- Further GROUNDWORK and GROUNDWORX marks across golf-course soil monitoring,
  collaboration software, and dues-payment software.

Class 9 software is taken by an established software company. Also 10 characters,
which is long for an icon label.

---

## Competitive finding (incidental)

The same searches surfaced a direct competitor worth a proper teardown:

**Prepared** — live on the iOS App Store, **$14.99**, positioned as *"a survival
expert in your pocket that works without internet, cell service, or Wi-Fi"*,
powered by on-device AI. Restricted to recent iPhone hardware.

This is the closest thing to a direct competitor found. Three observations:

1. It validates the offline-first premise — someone is charging $15 for it.
2. Its on-device-AI dependency restricts it to recent hardware, which directly
   contradicts §8's performance budget (usable on a five-year-old mid-range
   Android over 3G). That is an opening.
3. It has no visible equivalent of the kit ladder, weight budgeting, days-of-
   coverage, or the NRI baseline risk profile. Those remain differentiated.

Recommend a full teardown before positioning is finalized.

---

## Implementation

Pending sign-off, the name lives in a single brand config file. Changing it is
one commit, no refactor:

```
src/config/brand.ts   →  name, shortName, tagline, icon label, PWA manifest fields
```

Nothing else in the codebase hardcodes the product name.

---

## Sources

- [BlackSky Technology (NYSE: BKSY) — MarketBeat](https://www.marketbeat.com/stocks/NYSE/BKSY)
- [BlackSky Technology annual reports](https://www.annualreports.co.uk/Company/blackSky-technology)
- [Black Sky Hazards & Grid Resilience — T&D World](https://www.tdworld.com/disaster-response/article/21166948/black-sky-hazards-grid-resilience)
- [PUC, Governor and EIS Council host Black Sky Exercise](https://www.puc.pa.gov/press-release/2016/puc-governor-and-eis-council-host-black-sky-exercise-to-prepare-for-large-scale-outage-event)
- [Societal Resilience to Black Sky Hazards — Imperial College](https://imperial.ac.uk/events/145825/societal-resilience-to-black-sky-hazards)
- [BALLASTWATCH trademark detail — Justia](https://trademark.justia.com/766/20/ballastwatch-76620789.html)
- [BAAS BALLAST AS A SERVICE trademark detail — Justia](https://trademarks.justia.com/794/07/baas-ballast-as-a-79407275.html)
- [HARDTACK trademark detail (ser. 99830117) — Justia](https://trademarks.justia.com/998/30/hardtack-99830117.html)
- [Mainstay Labs Inc. trademarks — GleanMark](https://gleanmark.com/owner/mainstaylabsinc)
- [Mainstay Software Corp — LeadIQ](https://www.leadiq.com/c/mainstay-software-corp/5a1d848724000024005f1092)
- [GroundWork trademark detail — Justia](https://trademarks.justia.com/789/77/groundwork-78977788.html)
- [GROUNDWORK MONITOR trademark detail — Justia](https://trademarks.justia.com/971/53/groundwork-97153812.html)
- [GroundWork Open Source, Inc. trademarks — Justia](https://trademarks.justia.com/owners/groundwork-open-source-inc-2598919)
- [Prepared — iOS App Store](https://apps.apple.com/us/app/-/id6748543879)
