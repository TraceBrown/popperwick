---
name: doubt-driven-verification
description: Load when verifying any extracted claim, reviewer objection, or model-produced figure against a source — the CLAIM→EXTRACT→DOUBT→RECONCILE→STOP loop with cross-model escalation, plus the evidenced anti-rationalization table for the verification failure modes this vault has actually hit. Codifies what conductor verification already does by hand.
---

# Doubt-Driven Verification

Built 2026-08-06 on the user's "go ahead and build" ruling, from the
Sol+Kimi-amended steal list (`Sources/GitHub Trending Sweep (2026-08-06)`,
consult archive `.openai/2026-08-06-consult-steal-list.md`). The loop shape is
adapted from the community "doubt-driven development" pattern; the table
entries are this vault's own recorded failures, not imports.

**This codifies existing practice.** Nothing here grants new authority or
changes the delegation ladder: GLM still never verifies (change-control
non-negotiable 7); reviewer output is still a draft (CLAUDE.md Rule 1); the
conductor still adjudicates everything.

## The loop

For any claim about to enter a document of record (a number, a quote, an
attribution, a reviewer objection, a "this failed verification" drop):

1. **CLAIM** — state it exactly, with what would change if it were false.
   A claim you can't state crisply isn't ready to verify.
2. **EXTRACT** — locate the primary passage. Tolerant patterns FIRST, not as
   a retry (see table, row 1). Prefer a Python regex sweep over shell grep for
   anything numeric or table-derived.
3. **DOUBT** — ask the three questions before accepting the match:
   - Is this the *source's* claim or the *extractor's* paraphrase? (Hedges
     survive? Attribution intact? Scope qualifiers present?)
   - Does the arithmetic close? (A book's own worked example often proves or
     kills a disputed figure — the 25.6125 average fill could only be produced
     by 8 levels, which settled "ten vs eight" without further debate.)
   - Would a hostile reader with only the raw text accept this reading?
4. **RECONCILE** — three outcomes, each with a required record:
   - **Claim confirmed** → cite the locator.
   - **Claim corrected** → fix inline with a visible correction marker naming
     what changed and which pass caught it (house style: corrections stay
     visible, never silent).
   - **Cannot verify** → record as a drop **with the patterns tried**. A drop
     without its search record is unauditable — both false drops of 2026-08-06
     were only recoverable because the failed patterns could be reconstructed.
5. **STOP** — the loop ends when the claim's status is recorded, not when you
   are persuaded. Do not keep searching for a reading that rescues a claim you
   wanted to keep; do not keep attacking one that survived. One escalation
   maximum (below), then file the status you actually earned.

**Cross-model escalation (optional, one round):** when DOUBT leaves a genuine
inferential dispute — not a missing string, an actual "does the text support
this reading" question — escalate to a hostile second reader (`gpt-do` per the
MODEL-SWITCHING escalation rubric; Kimi for big-context re-reads). Their
answer is a draft: adjudicate it against the source like anything else.
Reviewer intuition never outranks a verified passage (see table, row 4).

## Adopted verification patterns (2026-08-17, anthropics/skills quarry, user-ratified)

Concept-level adoptions, re-expressed for this vault ([[Sources/Anthropics
Skills — Source Read (2026-08-17)]] T1-2/T1-4; they are patterns, not
incident-evidenced table rows — the table's own rule stands):

- **State the check's scope.** Every verification records what the green
  result proves and what it does NOT prove. A matching grep proves the
  string exists, not that the claim's hedges and scope survived; a clean
  simulation proves the formula evaluates, not that it's the right formula.
  Write the "does not prove" half down when it matters.
- **Know the silent passes.** Some failure modes return clean: a check run
  against the wrong file, a battery that never contained the claim, an
  extractor that dropped the qualifier the check wasn't looking for. When a
  pass surprises you, ask what could have passed silently — and prefer
  checks with a cheap tell (a count, a locator, a spot value) over bare
  booleans.
- **Inherited or introduced?** Before attributing a defect to the source or
  to an extraction, check the original: an error you introduced looks
  exactly like one you inherited. Baseline derived artifacts against what
  they were derived from, so upstream defects don't read as yours (and
  yours can't hide among them).
- **Blind the escalation.** When a dispute goes to the cross-model reader,
  strip model identity and provenance from the two readings — hand over
  content, not authorship. Judgment first, attribution after.

## Anti-rationalization table (evidenced entries only)

Scope discipline per the Sol amendment that shaped this file: entries exist
ONLY for failure modes with a recorded incident, and every entry carries its
escape hatch. Do not grow this table speculatively — a new row requires a new
incident with a citation.

| The rationalization | The rebuttal (with incident) | Escape hatch |
|---|---|---|
| "The grep found nothing, so the model invented it." | Two correct figures were dropped as fabrications because the books print `1, 048` and "Five percent" — the *pattern* failed, not the source (ETF/futures audit, 2026-08-06; memory: `verification-greps-tolerant-patterns`). Literal-miss ≠ absence. | After tolerant numerals, spelled-out forms, prose ratios, AND a Python sweep all fail, a drop is legitimate — record the patterns tried. |
| "The note reads fine; distillation-level checking is enough." | NotebookLM notes read fine for a month while carrying 10 errors across 6 of 12 notes, systematically dropping the books' hedges (futures-shelf audit, 2026-08-06; `Learning/README.md` fidelity section). Fluency is not fidelity. | A note already cross-lineage-audited against raw text this cycle doesn't need re-auditing to be quoted. |
| "The reviewer is a strong model and sounds confident, so apply the fix." | A reviewer's confident wholesale rewrite is the *measured* failure mode: +3 fixes / −13 regressions when the weaker-on-task model rewrote strong drafts (arXiv 2607.21656, conductor-verified); and Kimi's confident SPY-liquidity objection contradicted text its own audit had verified hours earlier (2026-08-06). | Surgical, single-invariant reviewer fixes that cite the source pass on normal verification; the elevated bar is for discard-and-rewrite suggestions and anything contradicting an already-verified passage. |
| "Both reviewers agree, so it's true." | Two models agreeing ≠ truth (CLAUDE.md, gpt-do doctrine). Blind *convergence* is strong evidence about where to look — it is not the verification itself. The L0→L3 steal was narrowed on blind convergence PLUS the conductor confirming the reasoning held (2026-08-06). | Blind convergence on a *scoping* judgment (not a factual claim) may be accepted on the reasoning without a source check — there may be no source to check. |
| "It verified before, skip the re-check." | The SPY/IVV five-year claim passed the first pass because it was never in the checked list — passing *a* battery is not passing *the* claim (CFA note correction, 2026-08-06). | A claim individually verified with a recorded locator this session stands; batteries don't expire mid-session. |

## When NOT to use this skill

Routine writing that makes no checkable claims; scratchpad work; reading.
For the full verification *recipes* (citation checks, GLM output QA, golden
inventory) use `vault-validation-and-qa` — this skill is the loop and the
discipline, that one is the procedures. On conflict, `vault-validation-and-qa`
governs.
