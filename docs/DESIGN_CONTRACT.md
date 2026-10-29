# Design Contract — Ballast interface

Produced by `/surprise-me`. The direction was chosen by a dice roll, not by
preference, and the contract below is fixed: the audit judges the render against
this card, so moving the contract to fit the render would defeat the audit.

```
roll seed          : 1793252772420379979
winning direction  : #2 of 7 — "Field notebook"
rolled palette     : acid neon on near-black
rolled type system : experimental display face + neutral body
rolled layout      : editorial magazine columns with pull quotes
rolled motion      : pinned scrollytelling with staged element reveals
rolled techniques  : broken grid · view-transition morphs · scroll choreography
```

The roll paired a *field notebook* direction with an *acid-on-near-black*
palette, which is not the obvious reading — the obvious reading is cream paper
and pencil. Taken literally the collision describes a surveyor's notebook read
by headlamp at three in the morning, which happens to be the exact circumstance
this product is built for. Committed to without softening.

---

## CONTRACT — Ballast interface — Field notebook, read by headlamp

**Feeling in one line**
You are holding a surveyor's field notebook at 3am and it is glowing.

**Palette**

| Token | Hex | Job |
|---|---|---|
| `--bg` | `#07080A` | near-black, faintly blue |
| `--paper` | `#0D1014` | the sheet |
| `--rule-minor` / `--rule-major` | `#141A20` / `#1E2730` | graph ruling |
| `--ink` | `#DCE3E8` | body |
| `--ink-dim` | `#78848D` | secondary |
| `--acid` | `#C9FF3D` | phosphor — the headlamp |
| `--stamp` | `#FF4A24` | the stamp, and high risk |

Acid on near-black measures ≈16:1; body ink ≈13:1. AAA either way, which the
category requires rather than merely permits.

**Type**
- **Redaction 70** — display and stamps. A degraded-halftone serif whose dots
  are visible at size; it reads as a document that has been photocopied too
  many times, which is the right voice for a field record.
- **Inter Variable** — body. Neutral on purpose, so the display face carries
  all the character and safety text stays calm.
- **Architects Daughter** — marginalia only. Gutter annotations, never body.

All three self-hosted and subset to 62.4 KB total, because a webfont link is a
network dependency on the render path and this product does not have those.

**Layout**
Editorial column with a **ruled margin gutter down the left**, as a notebook
has. Step numbers, annotations and stamps live in the gutter. The unusual rule:
**nothing is flush** — diagrams, stamps and pull quotes deliberately overhang
the gutter rule rather than respecting it.

**Techniques — all three, woven in**
1. **Broken grid** — the margin gutter and its overhanging elements, everywhere.
2. **View Transitions** — native shared-element morphs: a skill card's title
   morphs into the skill page heading; pages cross-dissolve rather than cut.
3. **Scroll choreography** — CSS scroll-driven animation (`animation-timeline`),
   so it costs zero JavaScript: staged reveals throughout, and one pinned
   sequence.

**Motion signature**
Pinned scrollytelling with staged element reveals.

**One unmistakable moment**
**The stamp.** On a skill page the sheet pins, and an acid rubber stamp rotates
in and lands across the ruled page — `DOES NOT PURIFY` — with the ink bleeding
unevenly into the paper. The limits then stage in beneath it, one per scroll
beat. You cannot scroll to the steps without passing through it.

This is the product's most important content rule turned into its most
memorable motion: the brief says the filtration-versus-purification distinction
must be impossible to miss, and a stamp you have to scroll through is the
literal form of impossible to miss.

**Assets**
Three real subset faces. SVG for the graph ruling, the stamp geometry with a
turbulence-displaced edge for ink bleed, and the hand-plotted coverage chart.
No photoreal imagery and no WebGL — this is an interface that must cold-boot
offline inside a 150 KB budget, and a technique that needs neither is the
better technique here, not a compromise.

**Out of scope — deliberately**
- **Nothing from this contract appears in GREY SKY.** No gutter, no stamps, no
  motion, no acid. It stays four things, white on black, 64px targets. The
  product's state machine outranks the design direction, and the switch from a
  glowing annotated notebook to a bare white-on-black list is itself the most
  dramatic thing the interface does.
- No WebGL, no photoreal 3D, no parallax on body text.
- No motion at all under `prefers-reduced-motion`.
```

---

## Audit record

The skill requires at least three screenshot → critique → improve passes before
anything is shown. Six ran.

**A note on the bar.** The method asks for a blind comparison against a named,
fetchable reference. External hosts are policy-blocked for this session — a
browser navigation to any public site returns `ERR_TUNNEL_CONNECTION_FAILED`
and the proxy logs a 403 on CONNECT — so no reference screenshot could be
obtained. Rather than invent a comparison, the audit ran against the contract
card above, the skill's explicit anti-pattern list, and measured numbers
(contrast ratios, bundle budget, the offline gate). That is weaker than a blind
comparison and is recorded as such.

| Pass | Biggest gap found | Fix |
|---|---|---|
| 1 | **Redaction 70 made the numerals unreadable.** `0` rendered as a filled rectangle. In a product whose headline is a number, disqualifying. | Redaction **35** for headings; numerals moved to the body face; 70 kept for the stamp, where a coarse over-inked die is correct |
| 1 | Desktop canvas 40% empty — one narrow column adrift in black, against a contract that says *editorial columns* | Real two-column grid with an instrument rail |
| 2 | Rail auto-placed into a new row instead of beside the prose, so it sat below the fold | Explicit `grid-row: 1 / span 500` |
| 2 | Content column ran to ~95 characters; the stave stretched to 860px and read as a stray underline | Column capped at 68ch, stave at 380px, measure sat on the baseline |
| 3 | **Grey Sky bug:** the gutter collapses to zero, so marginalia landed on top of headings | Marginalia hidden in Grey Sky, and below 900px — a pocket notebook has no margin either |
| 3 | The harness faked Grey Sky by setting a DOM attribute, so that screenshot was not what a user would get | Harness drives the real state toggle |
| 4 | Grey Sky links floated in a sea of black on desktop | Links fill the viewport height |
| 5 | **Bug:** the desktop grid's `align-items: start` leaked into the Grey Sky flex column and collapsed the buttons to content width | `align-items: stretch` |
| 6 | **"1 critical items missing"** — pluralisation fault | ICU plural form, plus tests |
| 6 | **`--ink-faint` measured 2.8:1** and was used for real text (tab labels, meta lines, stave legend) — below AA | Raised to `#747e86`, 4.6:1, with a contrast test that fails the build |

Two of those were defects a visual pass found that no test would have: the
Grey Sky width collapse and the contrast failure. Both now have tests.

**Where the render stands against the contract**

| Contract line | Result |
|---|---|
| Acid on near-black | Measured. Acid 17.0:1, ink 15.5:1, Grey Sky 21:1. All tokens clear AA, enforced by `tests/unit/contrast.test.ts` |
| Experimental display + neutral body | Redaction 35 headings, Inter body, Architects Daughter marginalia — three real faces, self-hosted, 68.2 KB subset |
| Broken grid, nothing flush | Margin gutter with overhanging stamps, section markers and marginalia |
| View-transition morphs | Native API; skill card title morphs into the detail heading |
| Scroll choreography | CSS `animation-timeline`, zero JavaScript; staged reveals and one pinned sequence |
| The unmistakable moment | The stamp lands, limits stage in beneath, and the offline suite asserts it is present |
| Grey Sky discards all of it | Enforced by test |

**Deliberate deviation, recorded rather than hidden.** The contract assigned
Redaction 70 to display. It is illegible for numerals at size, and the
headline figure of this product is a number someone may read at 3am. Legibility
of a safety figure outranks the type concept, so numerals use the body face and
headings moved to Redaction 35. The stamp still uses 70. This is the one place
the render was not moved to the contract.
