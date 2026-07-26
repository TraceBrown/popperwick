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
- **Render only from provided data.** Every number on a page traces to the
  embedded dataset (`const DATA = {...}`, embedded verbatim). Never invent,
  extrapolate, or "improve" a figure. A module without data ships as a
  labeled stub ("interactive module — not wired"), never with fake output.
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

Cautions from the panel record: **brief-dominance** — loaded vocabulary in
the brief ("lab report", "evidence-first") steers independent designers to
convergent identities; if you want taste diversity, sterilize the framing
words. Output budgets: a complete page runs 25k+ tokens — set caps
accordingly (kimi-do `KIMI_DO_MAX_TOKENS=32000` accepted). Strip redundant
payloads from reference bundles (a 3.2MB source file was 87% embedded
dataset + vendored chart lib the designer didn't need — the stripped 229KB
reference dispatched clean after the full one 400'd).

## 4. Pre-publish verification battery (run EVERY time, before Artifact publish)

Conductor-run, on the delivered HTML — publish only after all four pass:

```bash
# 1 external-reference sweep (expect ZERO hits; the SVG xmlns namespace
#   constant "http://www.w3.org/2000/svg" is the one known benign hit)
grep -nE "https?://|@import|fetch\(|XMLHttpRequest|<link|src=\"http|@font-face" page.html
# 2 script syntax — node --check every <script> block (extract, then check)
# 3 tag balance — open/close counts for section/div/table/svg/style/script
# 4 data fidelity — spot-grep the load-bearing figures against the source
#   dataset (net, rates, counts, the verdict grade); a D stays a D
```

Plus: theme markers present (`prefers-color-scheme` + `data-theme`),
reduced-motion present, `<title>` names the artifact (it becomes the gallery
name; keep it stable across redeploys; name the designer/variant when pages
compete). Publish artifacts as NEW files for concept variants — never
overwrite a canonical report with a concept.

## 5. Rejected defaults (from the panel + house guidance)

Terminal-black + neon glow for evidence documents (flatters weak results);
cream-serif-terracotta AI-slop template; emoji section markers; numbered
markers on non-sequences; tabs/rails that hide evidence ("evidence should
scroll, not hide" — Kimi); citations inside numeric table cells; internal
tool names rendered in citations (provenance is for sources, not plumbing).

## When NOT to use this skill

Calibrating how much design INVESTMENT a request deserves is the house
`artifact-design` skill's job (loaded automatically at Artifact time); this
skill is the vault's layer on top — ethics, battery, commissioning. Prose
documents of record (changelogs, reviews, rules) belong to
`vault-docs-and-writing`. Bench report *content* semantics (what the
verdict/gates mean) belong to the bench docs and `trading-proof-toolkit`.

## Provenance and maintenance

Written 2026-07-25 by the Fable 5 conductor under AUTH-006 item 6 (Q2),
from that week's design-panel records. If a future panel contradicts a rule
here, update THIS file with a dated correction — the raw panel archives are
the evidence trail.
