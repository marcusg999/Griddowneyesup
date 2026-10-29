# Architecture

> **Reconstructed, not supplied.** Brief §9 refers to "the architecture notes
> supplied alongside this brief." Those notes were not in the repository. This
> document is a good-faith reconstruction from the four patterns §9 names
> explicitly — CDN-snapshot for the public threat feed, server-side proxy for
> upstream APIs, explicit GRANT on every new Supabase table, and the client-side
> encryption boundary for the sensitive tier.
>
> **Correct it where it diverges from your intent.** It is a proposal.

---

## 0. The governing constraint

> **The network is an enhancement, not a dependency.**

Everything below follows from this. Where a design choice trades network
elegance against offline reliability, offline wins — without discussion.

Three rules that fall out, and that CI enforces:

1. **No render path may await the network.** The UI reads IndexedDB. Always.
2. **Sync is background reconciliation**, never a precondition for display.
3. **Degraded states are designed, not accidental.** *"Last synced 4h ago"* is a
   first-class UI state. A spinner, an error page, or a blank screen is a bug.

---

## 1. Stack

| Layer | Choice | Note |
|---|---|---|
| Client | PWA — Vite + TypeScript + React | D03 |
| Local store | IndexedDB | **Primary data source**, not a cache |
| Service worker | Workbox | Precached app shell + content pack |
| Hosting / CDN | Netlify | Static shell, immutable content packs |
| Edge compute | Netlify Functions | Upstream API proxy, snapshot builder |
| Backend data | Supabase (Postgres) | **Read-only public data only in v1** |
| Auth | **None in v1** | D06a |

### 1.1 What Supabase does *not* do in v1

Per D06a, v1 ships zero auth. Supabase holds no user data, no PII, no
per-user rows. Its entire v1 responsibility:

- `nri_counties` — FEMA National Risk Index, joined by FIPS code. Public record.
- Source-of-truth tables feeding the threat snapshot build.

No Supabase client ships in the browser bundle in v1. The app reads NRI data
from a static JSON artifact served by the CDN, generated at build time. This is
deliberate: it means the baseline risk profile works offline, forever, with no
network call at all.

---

## 2. The CDN-snapshot pattern (§9)

**Problem.** Upstream feeds (NWS, USGS, NIFC, OpenFEMA, SWPC) are rate-limited,
occasionally slow, occasionally down, and have terms that discourage per-client
fanout. Hitting them from the browser means N clients × M feeds, leaking user
location to five government endpoints, and a product whose reliability is the
product of five third parties' uptime.

**Pattern.**

```
upstream feeds                  our edge                        client
──────────────                  ────────                        ──────
api.weather.gov    ─┐
earthquake.usgs    ─┤      ┌──────────────────┐         ┌──────────────────┐
nifc / airnow      ─┼─────▶│ scheduled builder │────────▶│ immutable JSON   │
openfema           ─┤      │ (Netlify Function)│  write  │ snapshot on CDN  │
swpc.noaa.gov      ─┘      └──────────────────┘         └────────┬─────────┘
                                                                  │ GET
                                                        ┌─────────▼─────────┐
                                                        │ client: fetch once│
                                                        │ → write IndexedDB │
                                                        │ → render FROM IDB │
                                                        └───────────────────┘
```

**Properties:**

- One fetch per feed per interval, globally — not per user.
- The snapshot is a **content-addressed immutable artifact**. `snapshot-<hash>.json`
  plus a small `index.json` pointer. Immutable artifacts cache forever; only the
  tiny pointer revalidates.
- The client fetches the snapshot, writes it to IndexedDB, and **renders from
  IndexedDB**. The fetch is never on the render path.
- Snapshot carries `generatedAt` and per-signal `fetchedAt` + `ok` flags. This is
  what powers §4.1's confidence display — *"3 of 6 signals stale"* is read
  directly off the snapshot, not inferred.
- If a feed fails, the builder emits the last known good data for that signal
  with its original timestamp and `ok: false`. **A partial snapshot always
  publishes.** One dead upstream never blocks the other five.
- **No user location ever leaves the device.** The snapshot is national; the
  client filters it locally by the user's county and radius. This is a privacy
  property and a correctness property at once — filtering locally means it keeps
  working offline.

**Cadence:** 15 min for NWS and USGS, hourly for wildfire/AQI and SWPC, daily for
OpenFEMA declarations. Tunable per signal in the builder config.

---

## 3. Server-side proxy requirement (§9)

**No upstream API is ever called directly from the browser.** Without exception.

| Reason | Detail |
|---|---|
| Keys | Any keyed upstream (AirNow) would expose its key in a client bundle |
| CORS | Several government feeds do not serve permissive CORS |
| Privacy | Direct calls leak user IP and implied location to five third parties |
| Terms | Per-client fanout violates the spirit of most of these feeds' terms |
| Reliability | Upstream shape changes break the client; a proxy absorbs them centrally |

All upstream traffic goes through Netlify Functions. The proxy normalizes each
feed into our own signal schema, so an upstream format change is one deployment
rather than an app release.

In v1 this is exercised only by the snapshot builder, since the client talks
exclusively to the CDN. The proxy layer exists for the v1.1 curated news module
and for any future interactive query.

---

## 4. Explicit GRANT on every Supabase table (§9)

> **Every new table starts with zero privileges and is granted exactly what it
> needs, explicitly, in the same migration that creates it.**

Postgres defaults are permissive in ways that surprise people, and Supabase
exposes tables over PostgREST automatically. A table created without an explicit
privilege statement is a table whose exposure depends on defaults nobody
reviewed.

Required in every migration that creates a table:

```sql
-- 1. Create
create table public.nri_counties ( ... );

-- 2. Revoke everything from everyone, first
revoke all on public.nri_counties from public, anon, authenticated;

-- 3. Grant back exactly what is needed, and nothing more
grant select on public.nri_counties to anon;

-- 4. RLS on, always — even for public read-only data
alter table public.nri_counties enable row level security;

create policy "nri is public read-only"
  on public.nri_counties for select
  to anon
  using (true);
```

**CI gate:** a migration that creates a table without a matching `revoke`, an
explicit `grant`, and `enable row level security` fails the build. The check is
mechanical; it does not rely on review discipline.

Note that RLS is enabled even on public read-only data. It costs nothing and it
means no table in the database is ever in the "RLS off" state — so "is RLS on?"
is never a question anyone has to ask about any table.

---

## 5. Client-side encryption boundary (§9, D05)

### 5.1 Sensitivity classification

Every field in the schema declares a sensitivity class **at declaration**, not
at usage:

| Class | Examples | v1 behavior | v2 behavior |
|---|---|---|---|
| `public` | Skill content, kit templates, NRI county data | Shipped in content pack | Same |
| `local` | Inventory quantities, kit membership, achievements, drill logs | IndexedDB, syncable later in plaintext | Server-side at rest |
| `sensitive` | Medical needs, medications, document inventory, duress codes, rally-point coordinates, household member names and ages | **IndexedDB only. Never transmitted. No exceptions.** | E2E encrypted sync |

### 5.2 The boundary

All persistence routes through one interface:

```
┌─────────────┐     ┌──────────────────┐     ┌───────────┐
│ application │────▶│ CipherBoundary   │────▶│ IndexedDB │
└─────────────┘     ├──────────────────┤     └───────────┘
                    │ v1: IdentityXform│
                    │ v2: AES-GCM      │
                    └──────────────────┘
```

v1 registers the identity transform. v2 registers a real cipher **at the same
seam, with no call-site changes**. This is the entire point of building it now:
adding E2E sync in v2 becomes wiring a cipher into an existing interface rather
than re-tiering a live database with users' medication lists in it.

### 5.3 v2 constraints, recorded now

- Passphrase-derived key. Argon2id.
- Server never holds plaintext or the key.
- **No recovery if the passphrase is lost.** This must be said plainly in the UI
  at the moment of choosing it, not buried in a help article.
- Multi-device key exchange is the hard part and is designed before it is built.

### 5.4 Why `sensitive` is local-only rather than encrypted-and-synced in v1

Because an encryption scheme that has not been reviewed is not a safety feature,
it is a liability wearing one. Local-only is a promise we can keep absolutely in
v1 with zero cryptographic risk.

---

## 6. Content pack format

The content pack is the reason airplane mode works. It ships **with the app**,
precached by the service worker before first need.

```
/content/
  index.json            manifest: version, hash, locale, builtAt, entry list
  skills.<hash>.json    all skills, rendered and search-indexed
  kits.<hash>.json      kit ladder, hazard overlays, dependent overlays
  items.<hash>.json     canonical item catalog w/ weight, volume, cost tiers
  nri.<hash>.json       FEMA NRI county baseline risk
  search.<hash>.idx     prebuilt full-text index
  index.json.sig        detached signature over index.json
```

**Signed.** `index.json` carries the hash of every artifact; a detached signature
covers `index.json`. The client verifies the signature and each artifact hash
before activating a pack. An unverifiable pack is rejected and the previous pack
stays active — a failed content update must never degrade a working install.

**Versioned and immutable.** Content-addressed filenames mean a pack is cached
forever once fetched. Updates ship a new `index.json`.

**Search index is prebuilt.** Building a full-text index on a five-year-old
mid-range Android at first launch is the wrong place to spend the user's battery.
It is built at CI time and shipped.

---

## 7. Offline test suite — the release gate

Per §2 and §8: **a build that fails the offline suite does not ship.** This is a
gate, not a report.

Playwright, network disabled at the browser-context level (not mocked — actually
disabled):

| # | Test |
|---|---|
| 1 | Cold boot with network disabled from first paint |
| 2 | Navigate every route |
| 3 | Full-text search the skills library, get results |
| 4 | Mutate inventory; reload; mutation persisted |
| 5 | Build a plan end to end |
| 6 | Export a PDF |
| 7 | GREY SKY hides every gamification element (D16 / policy G08) |
| 8 | No render path awaits a network call — asserted by failing on any outbound request during render |

Test 8 is the one that keeps the premise true over time. It is easy to
accidentally introduce a network dependency into a render path during a refactor;
it is not easy to notice.

---

## 8. Performance budget (§8)

Target: usable on a **five-year-old mid-range Android over 3G**.

| Metric | Budget |
|---|---|
| App shell, gzipped | ≤ 150 KB |
| Content pack, initial | ≤ 2 MB |
| Time to interactive, cold, 3G | ≤ 5 s |
| Time to interactive, warm, offline | ≤ 1 s |
| Route transition | ≤ 100 ms |

Enforced by a CI bundle-size check. Exceeding a budget fails the build.

---

## 9. Accessibility (§8) — treated as a survival feature

Not a compliance checkbox. In GREY SKY the user may be shaking, gloved, in the
dark, one-handed, injured, or holding a child.

- WCAG AA minimum; AAA contrast in GREY SKY
- Full keyboard navigation
- Screen-reader correctness, tested
- `prefers-reduced-motion` respected
- **One-handed layout mode** — primary actions reachable in the lower third
- GREY SKY tap targets ≥ 64 px
- Nothing conveyed by color alone; print output is black and white and legible at
  arm's length (§7)

---

## 10. Internationalization (§8)

English-only at launch, i18n from commit one. Not retrofitted.

- No hardcoded user-facing strings in components. Enforced by lint rule.
- Content packs are locale-scoped: `content/en-US/...`
- Units, dates, numbers through `Intl`
- Baseline risk behind `RiskProfileProvider` (D01) — FEMA NRI is the first
  implementation; the UK National Risk Register is a second provider, not a
  rewrite

---

## 12. Paper: the print pipeline (§7)

**No PDF library is bundled.** Printable documents are real HTML rendered
through the browser's own print pipeline, with print stylesheets doing the
layout.

This looks like a shortcut and is not. The alternatives were weighed:

| | Browser print | Bundled renderer (jsPDF / pdf-lib) |
|---|---|---|
| Bundle cost | **0 KB** | 100–160 KB gzipped, against a 150 KB budget |
| Text | **Selectable, searchable, screen-readable** | Drawn, often unsearchable |
| Paper size | **The user's own, whatever it is** | Hardcoded at build time |
| Reflow | **Automatic** | Manual layout maths per document |
| Offline | **Inherent** | Needs the library precached too |
| Output | Print dialog → paper, or Save as PDF | A file |

The brief's goal in §7 is **ink on paper**, not a file: the failure mode being
designed around is a dead phone. Every platform this ships to offers "Save as
PDF" from the same dialog, so the file is available anyway — it is just not the
primary path.

A bundled renderer would cost a third of the performance budget to produce a
worse document. If a true file download is wanted later (emailing a plan to a
relative, say), it can be added as a lazily loaded chunk without touching this.

### 12.1 Design rules on paper

- **Black and white.** Nothing conveyed by colour alone.
- **Legible at arm's length.** 11pt body minimum.
- **No background fills.** A printer low on toner must still produce a
  readable sheet.
- **An empty field prints as a ruled blank**, so a half-finished plan can be
  finished at the kitchen table with a pen.
- **An incomplete plan says so on the sheet.** A printed plan with blanks in it
  is worse than no printed plan, because it looks finished.

### 12.2 The preview must measure what the printer gets

Print routes render without the app's chrome — their own branch of the router,
not the app wearing a stylesheet — so nothing in the shell can leak onto paper.

The on-screen preview is sized to the printed content width. This caught a real
bug: with `box-sizing: border-box`, a 190mm max-width minus 14mm of padding
left 162mm of content on screen while `@page` margins gave the printer 190mm,
so wallet cards that fit on paper stacked one-up in the preview. A preview that
does not match the printer is worse than no preview.

### 12.3 Tested as PDFs, not as pages

The offline suite renders each document through `emulateMedia({media:'print'})`
and generates an actual PDF, asserting the `%PDF-` header and a non-trivial
byte length. Asserting the page looks right would not catch a print stylesheet
that collapses at paper width.

---

## 11. Deliberate v1 non-dependencies

Listed explicitly because each is a thing that would otherwise creep in:

- No auth provider
- No Supabase client in the browser bundle
- No analytics SDK
- No error-reporting SDK that phones home on the render path
- No web font loaded from a third-party origin
- No runtime CDN dependency for app code
- No AI inference, on-device or remote — the §8 performance budget forbids the
  former and the offline premise forbids the latter

The app must boot and be fully useful with every one of these absent, because in
the scenario it is built for, they will be.
