---
name: vault-architecture-contract
description: Load when you need to understand WHY this vault/conductor system is designed the way it is before changing it — the division of labor across models, why GLM is tool-less, why verification is never delegated, the three-pillar vault structure, why several integrations are deliberately manual, and the known weak points. Read before proposing architectural changes or "improvements."
---

# Vault Architecture Contract

The load-bearing design decisions of this system, with rationale. If a proposed change contradicts one of these, the burden of proof is on the change.

## The system in one paragraph

`~/Claude` is simultaneously (a) an Obsidian vault, (b) a git repo, and (c) the working directory of a **research conductor**: a Claude session (Opus 4.8 by default; Fable 5 for freeze-grade escalation; routing per MODEL-SWITCHING.md "Model-selection doctrine", frozen 2026-07-15) that frames questions, searches, verifies, and synthesizes — while delegating bulk reading/summarizing to **GLM 5.2**, a cheaper model invoked headlessly via the `glm-do` CLI. The project's proving ground is evidence-based retail futures trading research (MES/MNQ), but the vault's declared scope is a general "companion that learns with me" — trading is the first domain, not the boundary (that's why the vault is named `Claude`, not `Futures`).

## Invariant 1 — The delegation ladder

| Tier | Who | What | Why |
|---|---|---|---|
| Judgment | The conductor session (you) | Framing, source selection, verification, synthesis, final writing | These fail silently when done cheaply |
| Bulk text | GLM 5.2 via `glm-do` (pipe content in; it has NO tools) | Reading, summarizing, extraction, first drafts | ~free relative to Claude tokens; quality sufficient when verified |
| Code | Opus subagent | Writing/editing/debugging any script or install | Historically produced verified, working infra in one shot |
| Cross-examination | GPT via `gpt-do` (`--sol` deep / `--luna` quick; headless, read-only sandbox) — live since 2026-07-09 | Adversarial review of plans, verdicts, freezes, closures | Two models agreeing ≠ truth; verification stays against primary sources. Judgment-bearing closures need an origin-independent reviewer per the reviewer matrix (AUTH-001 item 4) + the reviewer-output rule (AUTH-003 item 3); archive `.openai/` |
| Verification | Kimi K3 via `kimi-do` + the Verifier-Lane engine — since 2026-07-22 | Independent verification packets, wave audits of the vault itself | Fourth lineage; independence rule + usage doctrine in `MODEL-SWITCHING.md`; archive `.kimi/` |
| Audits | **SUPERSEDED (Wave-3 M4 marker, 2026-07-23) by the reviewer matrix — AUTH-001 item 4:** GPT-origin work → Kimi/Anthropic; Anthropic-origin → Sol/Kimi; Kimi-origin → Sol/Anthropic; conductor primary verification always controlling. *(Historical row: "Fable 5 via user-triggered `/model` switch" was the audit seat through early July — it twice caught real conductor errors, `vault-failure-archaeology` F6, F7. What makes an audit work is fresh adversarial framing + verification commands, not model identity.)* | Judging accumulated work, catching the conductor's own errors | Model routing lives in `MODEL-SWITCHING.md` (canonical) — do not bake current model choices into this contract |

**GLM is tool-less BY DESIGN.** It cannot search or fetch. You fetch raw bytes and pipe them in (`curl -s "$URL" | glm-do "..."` or `cat file | glm-do`). Do not "fix" this by giving GLM tools — the design keeps its failure mode (misreading text it was given) verifiable, instead of un-verifiable (inventing sources).

**Verification is NEVER delegated down the ladder.** Not to GLM (tool-less, and the cheaper model is the one being checked), not to a subagent's self-report (independently confirm file/system claims with your own `ls`/`grep`). This is the single most load-bearing rule in the system.

**User preference (2026-07-04, saved to memory):** GLM does the bulk reading *on every tier* — even when the session itself is Fable, the conductor only fetches, spot-checks, and judges.

## Invariant 2 — The three pillars + the loop

- `Futures/` — deep, verified research (papers, reviews, curriculum docs).
- `Learning/` — general education pipeline (NotebookLM → Notes/Quiz/Flashcards; spaced-repetition plugin).
- `Journal/` — **the feedback loop**: `Trading Plan.md` holds falsifiable rules; `Trades/` and `Backtests/` hold the evidence that tests them.

The loop is the system's reason to exist: a 2026-07-02 `/roast` council found the biggest gap was "research with no feedback loop back to outcomes." CLAUDE.md Rule 5 (every research cycle terminates in a rule or a stated null) plus the `close-the-loop.sh` Stop hook are the fix. **Any change that makes producing research easier without making rule-conversion easier widens the original gap** — this was the finding of the second Fable audit ("the bottleneck is conversion, not research volume").

## Invariant 3 — Deliberately manual bridges

These look like missing automation. They are decisions:
- **TradingView**: no API exists; scraping is ToS-banned with real account risk. Manual chart/alert workflow only.
- **Backtest tool**: no API; user exports artifacts into `Journal/Backtests/` by hand. Automate only after the manual loop is proven in use.
- **Gemini Deep Research**: available on the user's Google plan, documented in CLAUDE.md as optional/manual/never-default — user runs it themselves and brings results back.
- **NotebookLM login**: user-only, always.

## Invariant 4 — Memory philosophy

The conductor's persistent memory (`~/.claude/projects/-Users-OWNER-Claude/memory/`) is **hand-curated, typed, deliberately small** — judgment-call writes, not auto-capture. A capture-everything alternative (`claude-mem`) was evaluated and explicitly skipped (2026-07-03 Fable audit): auto-capture inverts the curation philosophy and would double-write. Don't bolt it on.

## Known weak points (stated plainly, not fixed yet)

1. **Git lags the changelog** (~2 days as of 2026-07-04). History-of-record is `Changelog.md`, not git log.
2. **Retrieval is Level-1** — meaning plain files, folder structure, and wikilinks with CLAUDE.md as the router (plus the connected Obsidian MCP server for text search); no semantic index or knowledge graph. Deliberate until retrieval failure is demonstrated (the trigger condition is defined in `vault-research-frontier` B2).
3. **The Stop hook contaminates headless `glm-do` runs launched from vault cwd** (discovered 2026-07-04): project-scoped hooks load into ANY `claude` process started in `~/Claude`, including glm-do's. Workaround: always run `glm-do` from a neutral cwd (scratchpad). Durable-fix candidate (not yet applied — route through change control): make `glm-do` cd to a temp dir before exec.
4. **The unbuilt "Option 2":** `RESEARCH-CONDUCTOR.md` (vault root) describes two architectures — Option 1, the live one (GLM reached via the headless `glm-do` CLI), and Option 2, a router proxy that would let GLM run as true in-session subagents. Option 2 was never built; don't assume in-session GLM subagents exist.
5. **Rule/candidate state moves — never trust a count or status written here.** The binding view is [[Journal/Trading Plan/candidate-state-registry]] (charter amendment F). As of 2026-07-23 (registry-copied, will rot): 001 ACTIVE (cost bar, awaiting broker re-anchor) · 002 RETIRED (misfounded) · 003 RETIRED (gate-adds-no-value) · 004 RETIRED (claim REFUTED) · 005 ACTIVE (untested, 0 round-trips) · 006 ACTIVE (frozen meta-rule). The original weak point ("written but untested") described the pre-Gen-1 state and is history; `trading-rule-validation-campaign` carries a STALE banner.

## When NOT to use this skill

Day-to-day operation → `vault-run-and-operate`. Permission gates → `vault-change-control`. The trading-domain theory → `futures-microstructure-reference`.

## Provenance and maintenance

Written 2026-07-04 from CLAUDE.md, RESEARCH-CONDUCTOR.md, Journal/README.md, Changelog.md, and live session records. Re-verify:
- Delegation wiring: `cat ~/.local/bin/glm-do` (should exec `claude --settings ~/.claude/settings-glm.json -p` with `"model": "glm-5.2"` pinned in that settings file).
- Obsidian MCP still connected: `claude mcp list` (expect `obsidian: uvx mcp-obsidian - ✔ Connected`).
- Weak point #1: compare `git -C ~/Claude log -1 --format=%cd` against Changelog.md's newest entry.
