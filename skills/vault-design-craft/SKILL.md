---
name: vault-design-craft
description: Load when producing, commissioning, or reviewing any visual artifact for this vault — bench reports, published claude.ai artifacts, dashboards, HTML exhibits. The presentation-ethics doctrine (the skin must never flatter the result), the hard constraint battery for self-contained pages, the designer-commission pattern, and the pre-publish verification battery.
---

# Vault Design Craft

Distilled 2026-07-25 (AUTH-006 item 6, Q2) from the bench-redesign design
panel — two designer models briefed blind at max effort, both verified and
published — plus the pre-publish battery the conductor ran before either page
went live. Sources: `.kimi/2026-07-24-bench-redesign-kimi.md`,
`.openai/2026-07-24-bench-redesign-sol.md`, [[Sources/ChatGPT Plugin
Directory — Finance Review (2026-07-24)]] (Q2 line).

## 1. Presentation ethics (the load-bearing section)

This vault's identity is evidence-first, failure-forward honesty. Its pages
obey the same law as its prose:

- **The skin must not flatter the result.** A grade-D backtest must read as
  a D at first glance. Both blind designers independently derived this and
  rejected the glowing-terminal aesthetic for it — Sol: "a glowing grade
  risks turning the verdict into a game score"; Kimi: "terminal aesthetics
  flatter everything... make a D feel like a feature launch." A design that
  softens a bad verdict is a FAILED design regardless of polish.
- **Render only from identified data.** Every displayed number must trace
  to an identified authoritative input plus a documented deterministic
  transformation. Self-contained static artifacts embed the required source
  snapshot (`const DATA = {...}`) or a lossless documented projection;
  derived values must be reproducible from it. Never invent, extrapolate,
  or "improve" a figure. A module without data ships as a labeled stub
  ("interactive module — not wired"), never with fake output. (Wording
  Sol-revised 2026-07-25: the verbatim-embed form is the static-page case,
  not the general law — dashboards and derived figures obey the traceable+
  reproducible form.)
- **Omit, never fabricate.** Insufficient data for a chart/cell → omit the
  artifact and say so (same rule as vault-validation-and-qa's typed
  missingness).
- **Downsample banners.** Any page built on reduced data declares it near
  the top (what was downsampled, where the canonical full version lives).
- **Semantic color ≠ accent.** Gain/loss/warning hues are their own channel
  and never double as the identity accent; the accent never editorializes a
  result. (Both panel designs kept warning-ochre ownership of the verdict.)
- **Uncomfortable is allowed.** The strongest move in the panel was an
  oversized red D consuming the opening viewport. Honesty may be a design
  feature; render the thinness of an edge "as geometry, not adjectives"
  (Kimi's CI strip straddling zero).

**SCOPE — what this section governs, and what it does not (user ruling,
2026-08-04).** Everything above binds **evidence artifacts**: bench reports,
verdict filings, dashboards, backtest exhibits, anything whose job is to let a
reader judge a result. It does **not** bind a deliberate **persuasion
artifact** — a pitch page, an application deck, something built
to advocate. There the job IS to make the case as compellingly as it can
honestly be made, and hallmark's craft rules become straightforwardly useful.

Two hard limits on that carve-out, or it eats the rule:
1. **The genre is declared before the work starts, never discovered after the
   result disappoints.** "This is a persuasion piece" is a brief-time
   decision. Retrofitting it onto a weak finding is the exact failure §1
   exists to prevent.
2. **Persuasion licenses emphasis, framing, and polish — never fabrication.**
   The honesty floor is unconditional: no invented metrics, testimonials,
   logos, or case-study counts, in any genre (the one rule imported outright
   from the external packs — hallmark gate 46). Advocacy selects what to
   foreground among true things; it does not manufacture them.

A bench report may never wear persuasion clothes; a pitch may never wear
evidence clothes it has not earned.

## 2. Hard constraint battery (self-contained pages / claude.ai artifacts)

Violating any of these fails the commission:

1. ONE self-contained file. No external requests of any kind — no CDNs, no
   webfont URLs, no remote images, no fetch/XHR (a strict CSP blocks every
   external host). System font stacks or data-URI embeds only.
2. Hand-rolled charts (canvas or inline SVG). No chart libraries unless the
   library is vendored inline by the CONDUCTOR (never reproduced from a
   model's memory — it will hallucinate the code).
3. Dual-theme via tokens: palette as custom properties on `:root`; redefine
   tokens under `@media (prefers-color-scheme: dark)`; then
   `:root[data-theme="dark"]` and `:root[data-theme="light"]` overrides must
   win in both directions. A deliberate single-theme world is allowed if
   argued in the rationale — a choice, never an omission.
4. Responsive to ~380px; wide tables/charts scroll in their own
   `overflow-x:auto` container; the body never scrolls horizontally.
   **(Hardened 2026-08-04, imported after the design-pack trial found both
   absent from our artifacts): root `overflow-x: clip` on BOTH `html` and
   `body` — never `hidden`, which breaks position:sticky; and
   `overflow-wrap: anywhere; min-width: 0` on display headings, which is what
   actually stops a long unbroken token blowing out the layout at 320px.**
5. `font-variant-numeric: tabular-nums` wherever digits align.
6. `prefers-reduced-motion` respected; keyboard focus visible.

## 3. Commissioning a designer model (the brief pattern)

The panel proved model designers do excellent work when the brief carries:
subject + audience + the page's single job; the honesty framing (§1) stated
as law; the full constraint battery (§2); an enumerated content program
(every module that must appear); the real dataset to embed; the deliverable
format (DESIGN RATIONALE first — identity, palette hexes, type roles, one
deliberate risk, what was rejected — then the complete HTML in one block);
and the current design as context WITH explicit license to reject it.

**Two-builders-one-judge (user-designed 2026-08-04; the answer to the
self-detection problem).** A model scoring its own output against a checklist
is the weakest link in every design skill — the mechanical gates (gradient
present? `transition:all`? banned font?) are genuinely self-checkable, but the
judgment gates (*is this generic? does it take a position?*) are exactly where
self-assessment fails, because the scorer is the generator. **The structural
fix is separation, not a better checklist:** two lanes build independently
from one sterilized brief, a THIRD lane judges — and a bad verdict is
answerable, not final. The builders may either revise or argue the verdict
back, and the conductor adjudicates against §1 and §2. This generalizes the
blind-designer-panel pattern that produced this file, and it is the same shape
as the tri-model method: independence first, judgment separated from
production, the conductor holding the last word.

Cautions from the panel record: **brief-dominance** — loaded vocabulary in
the brief ("lab report", "evidence-first") steers independent designers to
convergent identities; if you want taste diversity, sterilize the framing
words. Output budgets: a complete page runs 25k+ tokens — set caps
accordingly (kimi-do `KIMI_DO_MAX_TOKENS=32000` accepted). Strip redundant
payloads from reference bundles (a 3.2MB source file was 87% embedded
dataset + vendored chart lib the designer didn't need — the stripped 229KB
reference dispatched clean after the full one 400'd).

## 4. Pre-publish verification battery (run EVERY time, before Artifact publish)

Conductor-run, on the delivered HTML. **Sol-reclassified 2026-07-25: the
greps are a PRELIMINARY LINT, not proof** — actual no-external-request
enforcement comes from the artifact platform's strict CSP (or a documented
equivalent); when the target host has no CSP, a rendered network audit
showing zero external requests is required before any claim of
self-containment.

```bash
# 1 external-reference LINT (allowlist: exact benign namespace constants
#   like the SVG xmlns "http://www.w3.org/2000/svg", and data: URIs —
#   which includes data-URI @font-face embeds; flag everything else,
#   including CSS url(), srcset, single-quoted attrs, module imports,
#   WebSocket/EventSource/sendBeacon, and dynamically built URLs)
grep -nE "https?://|@import|fetch\(|XMLHttpRequest|<link|src=|srcset|url\(|new WebSocket|EventSource|sendBeacon|import\(" page.html
# 2 script syntax — node --check every <script> block (extract, then check)
# 3 structure — parse with a real HTML parser (nesting validity), not
#   tag-count balance alone (equal counts can still nest invalidly)
# 4 data fidelity — a SAMPLED fidelity check: spot-compare the load-bearing
#   figures against the source dataset (net, rates, counts, the verdict
#   grade — a D stays a D). Sampling verifies samples; claiming "every
#   number traces" requires a programmatic data-to-DOM comparison.
```

Plus rendered checks (viewer or headless) at ~380px and desktop: no
body-level horizontal overflow; both OS themes AND both explicit
`data-theme` overrides in both directions; visible keyboard focus;
effective reduced-motion; contrast sanity. `<title>` names the artifact
(gallery name; stable across redeploys; name the designer/variant when
pages compete). Publish concept variants as NEW files — never overwrite a
canonical report with a concept.

**Publication gate (standing law, restated):** passing this battery is
necessary but does NOT authorize publication. Publishing, redeploying, or
replacing any externally visible artifact takes explicit per-instance user
approval under the external-action gate — private-by-default artifacts of
the conductor's own work-product are the scoped exception, and anything
beyond that scope asks first.

## 5. Rejected defaults (from the panel + house guidance)

Terminal-black + neon glow for evidence documents (flatters weak results);
cream-serif-terracotta AI-slop template; emoji section markers; numbered
markers on non-sequences; tabs/rails that hide evidence ("evidence should
scroll, not hide" — Kimi); citations inside numeric table cells; internal
tool names rendered in citations (provenance is for sources, not plumbing).

**Added 2026-08-04 (imported from the hallmark gate list after the sandbox
trial found it in our own shipped artifact):** **coloured left/right
side-stripe borders on cards.** A recognized LLM-default tell; it was present
on the `.tier` and `.callout` blocks of the planning page. Also
rejected: bordered containers nested directly inside bordered containers of
the same surface colour.

**NOT rejected here, contra the external packs: structural variety per
brief.** Hallmark's headline rule — two pages for two briefs should not share
a rhythm — is correct for landing pages and **wrong for this vault's
evidentiary series.** A grade-D bench report must sit in the SAME skeleton as
a grade-A so the verdict is the thing that changes. Comparability outranks
freshness for anything that reads as evidence.

## 6. External design skill packs (added 2026-08-02)

Third-party Claude-Code skill packs exist for UI/design craft. They are a
legitimate way to import taste the conductor does not natively have — Emil
Kowalski's framing, which is honest: *"agents don't have great taste."*

**`emilkowalski/skills`** — MIT, ~23.7k stars, install
`npx skills@latest add emilkowalski/skills`. Author built Sonner and Vaul;
worked at Vercel and Linear. Eight skills: `emil-design-eng` (core),
`review-animations`, `improve-animations`, `find-animation-opportunities`,
`animation-vocabulary`, `apple-design`, `pick-ui-library`, `prototype`.

Triage **for this vault's work**:

- **`prototype`** (builds multiple UI variations behind a comparison
  switcher) is the highest-value one here, and it is a structural answer to
  the **brief-dominance** problem recorded in §3: variations to compare beat
  one identity to accept, and they do not require sterilizing the brief first.
- **`animation-vocabulary`** is aimed at the USER, not the conductor — it
  teaches precise language for *requesting* motion. That closes the real
  bottleneck (brief specificity), which no amount of conductor-side craft
  fixes.
- **`emil-design-eng`**, **`apple-design`** — general craft, useful.
- The three animation-audit skills apply only when a page actually has motion.
- **`pick-ui-library` is largely DEAD for claude.ai artifacts** — the strict
  CSP (§2) blocks external libraries, so Radix/shadcn/etc. cannot load.
  Useful only for local projects.

**Precedence, non-negotiable.** House `artifact-design` calibrates investment;
THIS file carries the vault's ethics and constraints; external packs are
*taste input beneath both*. An external skill never overrides §1
(presentation ethics — the skin must never flatter the result), §2 (hard
constraint battery), or §4 (pre-publish battery). Where an external pack
recommends something §5 rejects, §5 wins.

**Status: NOT INSTALLED as of 2026-08-02.** Installing lands files in a
skills directory — if project-level, inside the vault and git-tracked, which
is a change-control item. See `Pending Decisions/010-external-design-skill-packs.md`.

**Category update (2026-08-04 GitHub-trending sweep):** the pack above is
still climbing (~24.8k stars, +19.8k that month — mainstream now, not a
find). A second candidate surfaced: **`Nutlope/hallmark`** (~21.6k stars) —
57 named anti-slop gates, an `audit` verb that scores existing pages and
returns a punch list without editing, and a `study` verb that extracts a
site's design DNA to a portable `design.md` (refuses pixel-clones). Same
precedence rule applies unchanged; same PD-010 gate for any install. Neither
installed.

## When NOT to use this skill

Calibrating how much design INVESTMENT a request deserves is the house
`artifact-design` skill's job (loaded automatically at Artifact time); this
skill is the vault's layer on top — ethics, battery, commissioning. Prose
documents of record (changelogs, reviews, rules) belong to
`vault-docs-and-writing`. Bench report *content* semantics (what the
verdict/gates mean) belong to the bench docs and `trading-proof-toolkit`.

## Provenance and maintenance

Written 2026-07-25 by the Fable 5 conductor under AUTH-006 item 6 (Q2),
from that week's design-panel records; **Sol-reviewed same night
(SOUND-WITH-EDITS — all six edits applied: publication gate, data-law
scoping, lint-vs-CSP reclassification incl. the zero-hits/SVG and
font-face contradictions, parser-over-tag-counts, rendered-check list,
sampled-fidelity naming)**. Raw review:
`.openai/2026-07-25-buildbatch-review-sol.md`. If a future panel
contradicts a rule here, update THIS file with a dated correction — the
raw panel archives are the evidence trail.

**Sandbox trial (2026-08-04, user-requested "play around with some").** Both
packs cloned to scratchpad, never installed; hallmark's 57 gates run as a
manual checklist against a REAL shipped artifact (the 2026-08-01 credit-card
roadmap). Outcome — the audit mode earns its keep in reference form:

- **1 real defect found:** coloured left side-stripe borders on cards
  (hallmark gate 5) — an LLM-default tell, present in our own artifact.
  **Adopted into this file's practice: no coloured side-stripe cards.**
- **2 borderline:** bordered container inside bordered container (gate 4);
  pure `#FFFFFF` as a base surface (gate 7).
- **1 fails-by-letter-but-correct-for-us:** gate 1 bans system-default display
  fonts — but §2's CSP forbids external font loading, so a system stack is
  *mandatory* here. **This is the concrete case for reference-only:** an
  installed skill would argue for a rule our constraints prohibit.
- **Gate 46 (never fabricate metrics/testimonials/logos) passed clean** and is
  hereby imported as house practice — it restates §1's presentation ethics in
  checkable form.
- **Worth adopting for the constraint battery (§2):** root `overflow-x: clip`
  (never `hidden`), and `overflow-wrap: anywhere; min-width: 0` on display
  headings. Both absent from our artifacts today.

Standing posture: **reference-only** (PD-010, both reviewers converged). Read
the rules, import the good ones here, do not grant standing prompt influence.
