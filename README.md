# Grid Down Eyes Up

> *Working name under review — see [`docs/BRAND.md`](docs/BRAND.md). **Ballast** is
> the current recommendation; the name lives in one config file and is one commit
> to change.*

**Offline-first disaster preparedness and threat intelligence.**

The app a person opens in the ninety seconds after they hear bad news. It tells
them what is actually happening near them, what to do in the next hour, and what
to buy before the shelves empty — and it keeps working after the towers go down.

**▶ [marcusg999.github.io/Griddowneyesup](https://marcusg999.github.io/Griddowneyesup/)**

Installable from the browser. Load it once, then turn the network off — the
library, your inventory and your plan are all still there, because they were
never coming from the network in the first place.

---

## The premise

> **The network is an enhancement, not a dependency.**

Most preparedness apps are web apps with a survival theme. Open one without a
signal and you get a spinner. That is a product that fails at the exact moment it
exists for.

So this one inverts it:

- Every life-safety instruction, checklist, plan and contact is **on the device
  before the user needs it**, in a signed, versioned content pack.
- The app boots, navigates, searches and renders its entire reference library
  with the radio off.
- Live data layers on top and degrades to a clearly labelled *"last synced 4h
  ago"*. Never a spinner, never an error page, never a blank screen.
- **Airplane mode is a release gate, not a feature.** A build that fails the
  offline suite does not ship.

---

## Three states

The whole interface reorganises around the current one. This is the spine, not a
skin.

| State | When | What it is |
|---|---|---|
| **BLUE SKY** | Nothing is happening | Calm, educational, slightly wry. Learning, inventory, plan building, gap analysis. Where users spend 99% of their time, and where the app earns retention. |
| **WATCH** | Something is forming | A *"next 48 hours"* action queue derived from the user's own gaps: fuel up, fill water containers, pull cash, charge banks, confirm rally point, refill prescriptions. |
| **GREY SKY** | It is happening | Strips to four things: **MY PLAN · WATER · SHELTER/HEAT · CONTACT.** Maximum contrast, large tap targets, no feed, no notifications except life safety. Assume 12% battery and one bar. |

---

## What makes it different

**The kit ladder.** Preparedness is a ladder of kits differentiated by distance
from home, duration and carry weight — EDC → Get Home Bag → Bedside → Home kit →
Bug Out Bag → BOV → INCH. One inventory record belongs to many kits at once, so
per-kit completeness is computed rather than re-entered. The ladder doubles as
the onboarding sequence: nobody starts with an INCH bag.

**Weight budgeting.** Almost everyone builds a bug-out bag they physically cannot
carry for a mile. Weight is stored per item, summed per kit, and expressed
against a percentage of bodyweight — with the trade shown plainly: *dropping the
4lb hatchet buys you 2 more litres of water.*

**Days, not checkboxes.** The headline number is not "items owned." It is
**"your household is covered for 4 days of water and 11 days of calories."**

**Second-order analysis that calms rather than alarms.** When a distant event
moves a price, the app shows the measured reading with its source and age, the
transmission chain as discrete links you can disagree with one at a time, and
what it costs *your* household as arithmetic on your own numbers. The chain
states where it is weaker than assumed: freight is 3–8% of a grocery item's
shelf price, so a 25% diesel rise is roughly 1–2% on most groceries — not a
doubling. Saying so is the difference between analysis and alarm.

**Baseline risk from day one.** FEMA's National Risk Index, ingested and joined
to the user's county, produces a standing risk profile before a single alert
fires: *your county ranks high for wildfire and drought, moderate for earthquake,
very low for hurricane.* Sourced, citable, free.

**Say what it does not do.** Filtration and purification are different operations
and conflating them kills people. A sand-and-charcoal column improves clarity and
taste; it does not make water microbiologically safe. Every one of the 50 skills
carries a required `doesNotDo` field — enforced by schema, not by discipline — and
every high-risk skill carries a stamp line you cannot scroll past. *Boiling spares
spores. CO has no smell. 20 feet, no exceptions. Do not rub limbs. Two different
doses. Never taste it.*

**Paper is the last backup.** The most likely failure mode is a dead phone, and
this app lives on a phone. Five printable documents — household plan,
wallet-sized rally card, contact card, supply checklist, and any skill page.
Black and white, legible at arm's length, no colour dependency. An unfilled
field prints as a ruled blank so you can finish the plan with a pen, and an
incomplete plan says so on the sheet, because a printed plan with blanks in it
is worse than none: it looks finished.

---

## What it refuses to do

- **No infinite feed.** The threat view is finite and ends.
- **No manufactured alarm.** There is a designed *"Nothing notable near you"*
  state, and most days should show it. The index going green is a feature.
- **No fear as a conversion mechanic.** Preparedness is mundane, cheap, boring
  and overwhelmingly about ordinary disruption — a four-day outage, a boil-water
  notice, a job loss. Not the apocalypse.
- **No geopolitics in the threat state.** World events inform *what horizon is
  worth planning for*; they never raise the alert level. A state driven by
  policy news has no threshold that would ever bring it back down.
- **No gamification of app usage.** Every mechanic rewards real-world state.
  No streaks for opening the app, no leaderboards, no score that decays to
  create urgency. A badge that describes the present disappears when it stops
  being true, because a badge that lies costs more than it buys.
- **No weapons, munitions, or tactics content.** Personal defence is handled as
  planning — awareness, de-escalation, avoidance, securing a dwelling. See
  [`docs/CONTENT_POLICY.md`](docs/CONTENT_POLICY.md).
- **Commerce can never move a recommendation.** Affiliate links exist, and the
  ordering is computed before any commerce data is attached — removing every
  offer leaves the order byte-identical, which is asserted by a test. The offer
  schema has no rank or placement field, so there is no position to buy.
- **No purchase link on a threat screen.** Pairing a price shock with a buy
  button is fear as a conversion mechanic. Enforced by test, and suppression
  means absence from the document, not CSS invisibility.

---

## Status

Scoping interview complete. **Build order step 1 is done and proven: the app
cold-boots, navigates, searches and mutates data with the network genuinely
disabled.**

| # | Build step | Status |
|---|---|---|
| 1 | Content schema, pack format, offline shell — **prove airplane mode** | ✅ Done |
| 2 | Supply system, gap analysis, kit ladder, achievements | ✅ Done |
| 3 | Plan builder + printable documents | ✅ Done |
| 4 | Skills library rendering and local full-text search | ✅ Done — **50 skills written**, at the top of the 40–60 target |
| 5 | Readiness-state machine and Grey Sky interface | ✅ Done — state machine, Grey Sky, and the Watch action queue |
| — | Interface design: *field notebook, read by headlamp* | ✅ See [`docs/DESIGN_CONTRACT.md`](docs/DESIGN_CONTRACT.md) |
| 6 | Encrypted sync, circles | v2 |
| 7 | Threat feed, CDN snapshot pipeline, Threat Index | ◐ Client half done — reads a signed snapshot, refreshes when the network returns, derives the band, renders the cards, and takes world context from the digest — reads a signed snapshot, derives the band, renders the cards. **The ingestion pipeline is not built**, so the digest is sample data, marked as such |
| 8 | Notifications | v1.1+ |

### The gate, currently passing

```
Shell 90.1 / 150 KB gzipped · fonts 68.2 / 100 KB · content 367.6 / 2048 KB
167 unit tests · 38 offline tests
```

The offline suite runs against the production build in a Pixel 5 profile with
the browser context genuinely offline — not mocked. It asserts a cold boot, every
route, full-text search, an inventory mutation surviving reload, coverage computed
locally, Grey Sky suppressing every gamification element, and that **no request
escapes the cache during render** — which is the assertion that keeps the premise
true through future refactors.

Steps 1–4 ship as a complete, genuinely useful offline product **before any
network feature exists**. If the app is not valuable with the radio off, no
amount of live data fixes it.

> The threat feed is deliberately not built first. It is the most fun and the
> least load-bearing.

---

## Key decisions

Full record in [`docs/DECISIONS.md`](docs/DECISIONS.md). The load-bearing ones:

- **US-only v1**, with i18n and a pluggable risk-profile provider from commit one
- **Beachhead is the urban/suburban 72-hour person**, not the homesteader
- **PWA only** — no native shells in v1
- **Zero auth in v1.** Once sensitive data is local-only and circles are
  print-only, nothing left in scope needs an account
- **Sensitive data never leaves the device.** Classified at declaration, routed
  through a cipher boundary that takes a real cipher in v2
- **Content is rewritten from public-domain federal and pre-1929 sources**, in
  our own voice, with citations and a last-reviewed date
- **40–60 deep skills**, not 300 thin ones
- **Signal cards with a qualitative band**, not a composite 0–100 number — the
  inputs do not support that precision
- **Every life-safety feature is free, permanently**

---

## Documentation

| Document | What it is |
|---|---|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Every scoping decision, marked confirmed or defaulted. Binding. |
| [`docs/CONTENT_POLICY.md`](docs/CONTENT_POLICY.md) | Content boundaries, ingestion filter, safety standard, review gate. Read as config by the pipeline and as assertions by CI. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | CDN-snapshot pipeline, proxy requirement, Supabase GRANT discipline, encryption boundary, offline test gate, performance budget. |
| [`docs/BRAND.md`](docs/BRAND.md) | Name pressure-test and trademark triage. |

---

## Stack

PWA (Vite + TypeScript + React) · IndexedDB as the **primary** data source ·
Workbox service worker · Netlify for static hosting and edge functions ·
Supabase for read-only public data only.

No auth provider, no analytics SDK, no third-party fonts, no runtime CDN
dependency for app code, no AI inference. The app must boot and be fully useful
with every one of those absent — because in the scenario it is built for, they
will be.

## Development

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run verify
```

`verify` runs the content pack build, lint, typecheck, content validation, unit
tests, the production build, the bundle-size budget check, and the offline
Playwright suite. The pack build comes first because it generates the signing
key module the app imports, so lint and typecheck both need it present. The offline
suite is a release gate: cold boot with the network disabled, navigate every
route, search the library, mutate inventory, build a plan, export a PDF.

### Deployment

A push to `main` deploys to GitHub Pages. The workflow runs the full release
gate first and uploads nothing if the offline suite fails — Pages is shipping,
and §2 applies to shipping.

Pages serves a project site from a subpath, so the deployed build is made with
the prefix baked in:

```bash
PUBLIC_BASE_PATH=/Griddowneyesup/ npm run build
```

Left unset, the build targets a domain root, which is what `npm run dev` and the
offline suite use. Everything that resolves a URL at runtime reads
`import.meta.env.BASE_URL` rather than assuming either. If a custom domain is
ever attached, drop the variable from the workflow — the site is at a root again.

The build also emits `404.html` as a copy of the shell, because GitHub Pages has
no history fallback and a deep link would otherwise miss on first visit.
