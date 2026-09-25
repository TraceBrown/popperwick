# Tri-model joint-planning method

*Curated snapshot (2026-09-25) of the private vault's
`Joint Plans/TRI-MODEL-METHOD.md`. The names of the private audit waves and the
private repository's coordinates were removed; the procedure is otherwise as
written.*

**What this is.** The procedure for remediating an audit (or any high-stakes
plan) using three independent frontier models, **Sol (GPT), Kimi, and Fable
(the conductor)**, followed by a conductor adjudication. The owner designed it
(2026-07-22: "each frontier model concoct a plan… look at each plan and see if
there is agreements or disagreements… whichever you think will produce the best
plan"). It has been used on three remediation rounds, each closed with a signed
authorization receipt.

**Why it works.** Three blind plans surface more than one; the conductor's
primary-source verification is the controlling step. It repeatedly settled
disagreements and caught the audit itself overstating. The middle-man pattern
(conductor adjudicates; no model-to-model debate) keeps every resolution owned
and auditable.

---

## The 12 steps

**1. Pick the wave.** Audits live in the Kimi archive (`.kimi/`), one file per
audit; work them in a fixed order.

**2. Write ONE shared commission** at `Joint Plans/<date> Wave-N Remediation/COMMISSION.md`.
It contains: (a) the findings **verbatim**; (b) an **updated binding-state
brief** reflecting every completion since the audit snapshot (this is what lets
planners mark findings already closed; keep it current: receipts, closed items,
closed waves); (c) the required output shape (per-finding disposition table,
sequenced phases, enforcement-vs-prose, authorization section, top-N moves,
what-NOT-to-fix); (d) a **disclosure clause**: where Kimi authored the audits,
tell Kimi to flag self-review weaknesses and recuse from scoring its own audit.

**3. Launch the three blind plans (parallel).** None sees the others.
- **Sol:** `cat COMMISSION.md | gpt-do --sol "…produce the plan…" | tee -a ~/sol-live.log > plan-sol.md`.
  An earlier note said `GPT_DO_EFFORT=max` returned empty output on large
  consults. That was **falsified on 2026-07-25**: a four-size regression ladder
  (10/65/150/300 KB) ran clean on both the default and `--sol` tiers with every
  answer verified exact against file tails. Max is usable; if empty output ever
  recurs, capture the exact call and input size before re-instating any ban.
  (Backgrounding the call inside another background job can still swallow
  output; prefer a foreground call with a long timeout.)
- **Kimi:** `cat COMMISSION.md | kimi-do --k3 "…plan; mark file-level steps VERIFY-CONDUCTOR…" > plan-kimi.md`
  (Kimi has no tools; it plans from the commission text only.)

**Reviewer access is not symmetric; say which "blind" you mean** (added
2026-07-28, evidenced the same night). The lanes differ in what they can see:
- **Sol: read-only filesystem access.** `gpt-do` runs Codex with
  `--sandbox read-only`. Sol can open vault files and cite exact paths and line
  numbers. He is blind to the *other plans*, not to the *vault*.
- **Kimi: genuinely tool-less.** Commission text only.
- **GLM: genuinely tool-less** (caged: `--bare --strict-mcp-config --tools ""`).
- **Anthropic subagent reviewers:** whatever the dispatch grants; state it.

Why this matters, demonstrated 2026-07-28: the conductor issued an overnight
commission whose state block contained two false claims (two rules listed as
open threads that had both been retired weeks earlier). Sol and the Opus
subagent, the two lanes with file access, both caught it independently. Kimi did
not, and built two work packets on the dead premises. That is not a Kimi
failure; it is structural. **A tool-less reviewer cannot detect a poisoned
brief; it can only reason within the frame it is given.** Consequences:
1. Brief accuracy is the conductor's job and cannot be outsourced to blind
   reviewers. Step 5's cold-checks catch errors in *reviewer output*; nothing
   catches errors in the *commission* except a reviewer who can go look.
2. For any commission whose premises are load-bearing, at least one
   verification-capable lane must be in the round; otherwise all three plans
   inherit the conductor's errors and agreement means nothing.
3. When reporting convergence, state which lanes could verify. Three lanes
   agreeing on a false premise is not corroboration; it is an echo.
- **Fable (the conductor):** write `plan-fable.md` **before reading the other
  two**, with your own cold-checks inline. Honesty of blindness matters.

**4. File all three verbatim** with a one-line provenance header each (model
and tier, any blindness break, the Kimi diagnostics line).

**5. Conductor cold-checks: the load-bearing step.** Verify every decisive claim
against the actual primary files (`grep`, `git show`, read the cited file). Most
"disagreements" dissolve here. Examples that mattered: a "no erratum filed"
finding was false (already filed, visible in `git show`); a "no disposition"
finding was false (a charter already adopted them); a "never confirmed" finding
was false (confirmed in a recorded decision). **Never trust an audit lead or a
model's claim over the primary.**

**6. Diff, then rebuttal (only if needed).** If genuine disagreements survive
verification, run one targeted rebuttal round: send each dissenter only their
contested points; ask for terse CONCEDE/HOLD (plus salvage). If cold-checks
already settled everything, skip the rebuttal and say so in the joint plan.
Never stage model-to-model back-and-forth.

**7. Adjudicate** into `JOINT-PLAN-WAVE-N.md` with a **disagreement ledger**
(each split, the three positions, how it resolved and why). Status starts
**DRAFT, awaiting owner ratification and a receipt**.

**8. P0 prose batch (no owner action, no receipt).** Do the clean edits
immediately: prose corrections, index regens, tombstones, rejection records,
recording already-done work into open items, drafting rows. Commit and push.

**9. Reviewer matrix (who closes what).** GPT-origin work is reviewed by Kimi or
Anthropic; Anthropic-origin by Sol or Kimi; Kimi-origin (the audits) by Sol or
Anthropic. Conductor primary verification is always controlling. **Exclude a
model from reviewing its own work or its own rule.**

**10. Reviewer-matrix closure review.** Method, evidentiary and judgment items
get an origin-independent review (for Claude-origin packets, `gpt-do --sol`)
before closing. Scope it explicitly (exclude party-conflict items).
Independently re-derive any statistics the disposition rests on (one round
re-derived Clopper-Pearson bounds in pure Python and matched the reviewer
exactly). Archive the review and add its index line in the same commit.

**11. Owner sitting and receipt (batched).** Bundle every owner ask into one
sitting of about fifteen minutes: settings toggles, rulings, and the
authorization-register paste made through the GitHub web editor. **Hold pushes
to `main` while the owner's web edit tab is open**, or their commit fails with
"Expected branch to point to … Pull and try again". Verify the receipt with
`gh api repos/<owner>/<repo>/commits/<sha>` (`verified: true`, committer
`GitHub`, parent equal to your HEAD). Then apply the ratified edits and cite the
receipt.

**12. Residuals** fold into the standing re-audit; the wave's `CLOSURE-LEDGER.md`
tracks what is terminal versus pending.

---

## Fixed conventions

- **Folder:** `Joint Plans/<date> Wave-N Remediation/` holding `COMMISSION.md`,
  `plan-{sol,kimi,fable}.md`, `rebuttal-*.md` (if any), `JOINT-PLAN-WAVE-N.md`,
  `CLOSURE-LEDGER.md`, and any draft.
- **Build-shaped fixes need a receipt.** Prose edits, owner rulings, and
  reproduced-defect config disables are the non-build classes. Everything runs
  under the expansion hold: no new daemons, skills or generators.
- **`kimi-do` on verifier material** needs an `INDEPENDENCE: DEGRADED` mark;
  infrastructure and governance configuration (like these plans) does not.
- **Tee every `gpt-do --sol` call to `~/sol-live.log`** (the owner's tail pane).

## Dispatch hygiene (added 2026-07-24)

- **Never pre-judge findings in a reviewer dispatch.** If your commission or
  review prompt contains "do not flag X", "treat Y as at most minor", or "the
  plan chose this", stop; you are grading your own work through the reviewer's
  pen. State constraints as facts in the brief; let the reviewer weigh them.
- **A party's rationale is a claim, not evidence.** A planner's or executor's
  stated reason never downgrades a finding's severity by itself.
- **Give every reviewer the cannot-verify lane** explicitly, so gaps surface as
  gaps instead of guesses.
- **Context economy on multi-dispatch waves:** briefs and outputs travel as
  files (commission piped in, plans redirected out); keep the wave's progress
  in the closure ledger as you go, and after any context compaction trust the
  ledger and the git log over recollection.

## Provenance

Written 2026-07-23 by the Fable 5 conductor from the three executed pilots.
Load-bearing: **step 5 (verify) is the whole game.**
