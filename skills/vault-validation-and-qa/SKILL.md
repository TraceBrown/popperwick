---
name: vault-validation-and-qa
description: Load when you need the concrete procedures for verifying anything in this vault — GLM output, subagent reports, citations/quotes/statistics, storm-research findings, book-pipeline outputs, or a Trading Plan rule's format. The step-by-step recipes with commands, plus the inventory of what is already verified ("golden") versus reported-only.
---

# Vault Validation & QA

What counts as evidence here, and the exact procedures. The companion doctrine is in `vault-research-methodology`; this skill is the how — **on any conflict between the two, the procedures here govern.**

**Terms:** `glm-do` = bash wrapper sending one headless text task to GLM 5.2 (you pipe content in; it has no tools). "Storm report" = output of the `storm-research` skill, lands in `~/Claude/storm-reports/`. "Fable audit" = a judgment pass run when the user switches the session to Fable 5 (`/model claude-fable-5`) — see `vault-run-and-operate` for the prompt shape. "The plugin" in Recipe 4 = Obsidian's `obsidian-spaced-repetition`. Rule 001 = the cost-bar meta-rule in `~/Claude/Journal/Trading Plan.md`.

## Recipe 1 — Verifying GLM output (mandatory, every time)

GLM (`glm-do`) misreads, over-claims, and occasionally invents. Treat every GLM return as a draft.

1. Spot-check each load-bearing number/quote against the raw source you piped in:
   `grep -o "the exact figure or phrase" /path/to/raw_source_file`
2. For HTML sources, grep the *raw fetched file*, not GLM's summary. Ligatures and tags break naive greps — try shorter substrings (`proﬁtability` vs `profitability` bit us once; tags split sentences: loosen the pattern before concluding a quote is absent).
3. Anything that fails the grep gets re-checked in context (`grep -B2 -A2`) before being called wrong — then either corrected or dropped. Never paper over.

## Recipe 2 — Verifying a citation to a primary source

1. Fetch the actual source (journal page, PDF, regulator site, GitHub API — not a blog citing it).
2. Confirm: exact title/authors/venue/year; the real figure as published; sample/method; author-stated limits; peer-review status (published vs preprint vs working draft).
3. Watch for the three failure modes we've actually caught:
   - **Inverted claims** — a lens said "no learning curve"; the paper said learning-via-attrition. Read the conclusion, not just the abstract.
   - **Superseded drafts** — a 2016 CFTC draft's finding differed from the authors' published 2018 version. Prefer the published version; flag when citing a draft.
   - **Homonyms** — a verbatim-real CME disclaimer was from an unrelated product sharing the name "Market Profile." A real quote can still be a false citation.
4. Verdicts: CONFIRMED / PARTIALLY CONFIRMED (list corrections) / UNVERIFIED / FALSE. UNVERIFIED means demote or cut — never assert on faith.

## Recipe 3 — Verifying a subagent's report

Never relay a subagent's file/system claims without independent confirmation:
```bash
ls -la <claimed paths>                 # files exist, sizes sane
grep -l "<distinctive content>" <files> # content is real, not placeholder
python3 -m json.tool <edited .json>     # config edits parse
```
Track record: a subagent-installed skill turned out to be a stub pointing at an uninstalled companion — caught only because its report was checked. Also run any script a subagent wrote through its own test cases once yourself.

For code changes, apply the **fail-under-broken test** (community pattern, r/claudeskills "Fable as a skill" thread, 2026-07-06 — the falsifiability check in code form): a test only proves the task if it FAILS when the fix is reverted/broken. A green test that also passes on broken code is fake-green. Two separate questions, asked separately: (1) does the gate actually prove the task? (2) does an adversarial read of the *diff itself* (not the agent's summary) hold up? This targets the vault's #1 recurring failure — subagents reporting "done" mid-verification. The critic-#2 seat is LIVE (2026-07-09): `gpt-do` at ~/.local/bin — tiers --luna/default-terra/--sol with per-tier reasoning effort; archive worthwhile verdicts to `.openai/` with the conductor's own check (see MODEL-SWITCHING.md).

## Recipe 4 — Book-pipeline output QA

Enumerate the artifacts with `ls ~/Claude/Learning/Notes ~/Claude/Learning/Quiz ~/Claude/Learning/Flashcards`. For each: exists, non-trivial size, and book-specific (grep a distinctive term — "value area" for Dalton, "absorption" for Wyckoff 2.0; finding "NBBO" in a Wyckoff file would signal cross-contamination). Flashcards intended for spaced repetition must use the plugin's multi-line format (`Question` / `?` / `Answer`, blank-line separated, `#flashcards` tag present).

## Recipe 5 — Trading Plan rule QA

A rule is well-formed iff: Statement is falsifiable as written (numbers, window, instrument); Derived-from links a real reviewed source; Falsified-if states the killing result AND a sample size; expected edge is stated against the Rule 001 cost bar; Status honest (`Untested` until evidence exists). The worked example in `Journal/Trading Plan.md`'s header is the standard.

## The golden inventory (verified, as of 2026-07-04)

- **Contract math**: MES tick 0.25pt = $1.25 ($5/pt); MNQ tick 0.25pt = $0.50 ($2/pt). CME public specs.
- **Cost anchors**: NinjaTrader free-plan all-in $0.95/side ($1.90/RT) for MES and MNQ, read from their published fee PDF; provisional bar ≈2.5–3.5 MES ticks / 5–8 MNQ ticks per RT (Rule 001; broker statement still pending).
- **CFTC base rates**: median retail futures trader loses $100–$200; 60th percentile breakeven; MES/MNQ the top-2 retail contracts (Ferko/Mixon/Onur 2024, PDF read directly).
- **Decay-horizon corpus**: 11 papers reviewed in `Futures/Strategy Article Reviews.md`, each with a verified-findings section; the cross-cutting pattern note there is the settled summary.
- **Two storm reports** in `storm-reports/`, both carrying per-citation verification tags — treat their "Safe to assert" sections as pre-verified claims.
- **Reported-only (NOT golden)**: anything in `Futures/GLM - Online.md` (a model's evaluation, never independently verified); abstract-only reviews (Griffin et al., Sun et al., Rosa 2022 — flagged low-confidence in the reviews file); all vendor-sourced stats (e.g. the "7% prop payout" figure).

## When NOT to use this skill

Choosing what to research or whether a finding merits a rule → `vault-research-methodology`. The statistical validation of trading rules themselves (backtest hygiene, sample size) → `trading-proof-toolkit`.

## Provenance and maintenance

Written 2026-07-04 from live verification sessions (storm runs, Fable audits, book pipeline). Re-verify: Rule 001 numbers against `Journal/Trading Plan.md`; the reviews file's coverage count (`grep -c "^## " "Futures/Strategy Article Reviews.md"`).
