---
name: vault-research-methodology
description: Load when starting any research cycle in this vault — reviewing a paper/book/video, evaluating a trading idea or indicator, running storm-research or /roast, or deciding whether a finding becomes a Trading Plan rule. Defines the evidence bar, the hypothesize-before-test discipline, the idea lifecycle from finding to rule to retirement, and where good ideas have historically come from here.
---

# Vault Research Methodology

The discipline that turns a hunch into an accepted result in this project — or into an honest, documented dead end, which counts equally.

## The core doctrine (from the project's own founding documents)

**Hypothesize → test. Never data-mine → rationalize.** Before investigating any edge/idea, write down: the structural, behavioral, or risk-based reason the edge *should exist*, and what result would prove it wrong. If you cannot state the falsification condition in advance, you are not doing research yet. This applies to the learning itself: before reading a book, write a one-paragraph falsifiable thesis for what it should change.

**The evidence bar for any claim entering the vault as fact** (doctrine version — the step-by-step procedures live in `vault-validation-and-qa`, which governs on any conflict):
1. Traces to a real, fetched, primary source — never a search-result synthesis, never GLM's unverified output, never a subagent's self-report.
2. Load-bearing numbers get byte-level verification (grep the exact figure/quote in the raw fetched source).
3. Statistics carry a source and an as-of date. Absence claims ("no study exists") require a documented search, not a shrug.
4. Gross vs. net matters: a trading result that ignores transaction costs is an upper bound, not an edge (the corpus's single most repeated lesson — see `futures-microstructure-reference`).
5. One mechanism must explain ALL observations, including the negatives. If your story explains the wins but not the losses, it's a narrative, not a mechanism.

## The idea lifecycle

```
idea/finding
  → reviewed (Strategy Article Reviews format: verified findings / relevance / verdict)
  → EITHER: falsifiable rule in Journal/Trading Plan.md   (statement, derived-from,
            falsified-if, status, sample)                 ← CLAUDE.md Rule 5
     OR: explicit stated null ("this cycle produced no actionable claim because…")
  → sim/backtest evidence accumulates in Journal/Trades/ + Journal/Backtests/
  → rule RETIRED as validated or falsified (kept, never deleted — a falsified
    rule with its evidence is more valuable than an empty page)
```

A finding that stays a finding has not done its job. The Stop hook (`close-the-loop.sh`) will block your session's end once per session if research files changed without a Trading Plan update — answer it with a real rule or a real stated null, never a ginned-up rule (that's the failure mode Rule 5 exists to prevent, stated in its own text).

## Adversarial instruments (use them; they have caught real errors)

| Instrument | What it's for | Track record |
|---|---|---|
| `storm-research` skill | Multi-lens verified briefing on a topic; Phase 4 verifies every citation | Flash Boys run: caught 2 fabricated + 8 wrong claims of 14. Mind Over Markets run: 0 fabricated, 9 corrected, 4 demoted of 19 |
| `/roast` skill | 5-persona stress test of an idea/plan | Its RESHAPE verdict on the vault itself produced the Journal loop — the system's most important correction |
| Fable 5 audit (not invocable by you — the USER switches the session via `/model claude-fable-5`; your role is to draft the audit prompt using the shape in `vault-run-and-operate`) | Judgment pass over accumulated work | Caught the "cache bug unresolved" inversion AND the "Superpowers installed" phantom (2026-07-03); caught the empty-Trading-Plan gap the same day |
| `grilling` skill | Relentless pre-work interview to front-load context | Installed 2026-07-03; use before large ambiguous tasks |

**Verification of the verifiers:** storm lenses and subagents cite sources; you re-verify the load-bearing ones against primary sources yourself. Two search-artifact "statistics" were caught and discarded this way during the Mind Over Markets run — search synthesis invents plausible numbers.

## Where good ideas have actually come from here

Historical pattern worth knowing (mined from Changelog + reviews): the productive ideas came from (a) *boundary-condition papers* that killed something cleanly (Takahashi's 1-second decay; Heston's t>9.6-but-unprofitable), (b) *adversarial passes* over our own system (roast → Journal; Fable audits → corrections), and (c) *the one mechanical claim in a sea of narrative* (Market Profile's "80% rule" — the only testable sentence in a 40-year-old framework, now candidate Rule 004; 2026-07-15 caveat: the sentence is retail folklore, not Dalton's — his text claims only "a good possibility"). The unproductive pattern: collecting more affirmative papers/books before converting the last batch into rules.

## Numbers you must respect when evaluating any trading idea

- Base rate: median retail MES/MNQ account **loses $100–$200**; breakeven = 60th percentile (CFTC staff data, verified 2026-07-04).
- Multiple testing: ~50/1000 random strategies look significant at 5% by chance. Pre-register or discount.
- Statistical ≠ tradeable: a t-stat over 9 can still lose money after the spread (Heston et al.).
- The cost bar is codified as Trading Plan **Rule 001** — every rule's expected edge must clear it.

## Imported craft (2026-07-24, from the Kimi plugin-review corpus — [[Sources/Kimi Plugin-Skill Review (2026-07-24)]]; deweaponized per Sol's rule)

**Replication discipline (for any paper/claim we reproduce):**
- Keep a **claim ledger**: every target claim gets a fidelity label — `exact` / `near` / `conceptual` / `not_testable` — and a **data-equivalence grade A–E** vs the paper's data; the weakest *material* grade caps the replication verdict. A matching sign alone is `directional_only`; several directional matches never sum to a numerical replication claim.
- **Freeze before OOS:** hash code+parameters+data-map+costs and record the freeze time BEFORE looking at any out-of-sample result. Keep three OOS species separate, never merged: `sample_extension` (same market, later data), `post_publication` (after dissemination + realistic implementation lag), `transport` (different market/universe — ours, usually MES/MNQ).
- **Discrepancy ladder** (diagnose in order, record the FIRST material driver): paper version/vintage → universe/survivorship → prices/actions/units → signal availability+lags → filtering/weighting → inference (overlapping obs, SEs) → costs → implementation defect — with integrity tests run both before AND after data reconciliation (defect-last is unsafe as a pure ordering).

**Evidence vintage (for any historical narrative or cycle claim):** label every source `contemporaneous` / `near_contemporaneous` / `hindsight`, machine-readably; if the then-known information set cannot be reconstructed, the output is `not_testable` or a NARROWER claim — never a conclusion quietly built from hindsight summaries. Cohorts include the delisted/failed members when sourceable.

## When NOT to use this skill

Executing the current flagship campaign → `trading-rule-validation-campaign`. The statistical recipes themselves → `trading-proof-toolkit`. What counts as verified evidence procedurally → `vault-validation-and-qa`.

## Provenance and maintenance

Written 2026-07-04 from CLAUDE.md Rule 5, Journal/README.md, Futures/Claude - Previous Chats - Online.md (methodology sections), Strategy Article Reviews, and audit session records. Re-verify: Rule 001's current bar in `Journal/Trading Plan.md`; the hook message text in `.claude/hooks/close-the-loop.sh`.
