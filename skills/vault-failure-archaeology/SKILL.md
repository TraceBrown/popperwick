---
name: vault-failure-archaeology
description: Load before re-investigating anything that feels "already looked into" in this vault — a bug, a tool that was tried, an integration that failed, a claim that was corrected. The chronicle of every major investigation, dead end, rejected fix, and correction, as symptom → root cause → evidence → status, so no one re-fights a settled battle.
---

# Vault Failure Archaeology

Settled battles. Check here before spending tokens re-deriving any of these. Format: what happened → root cause → evidence → current status.

**Terms:** "the conductor" = the Claude session operating this vault (you). `glm-do` = headless GLM 5.2 wrapper (`~/.local/bin/glm-do`); "GLM-pipe + grep pattern" = fetch raw source yourself → pipe to glm-do for extraction → grep the raw file to verify its load-bearing claims (full recipe: `vault-validation-and-qa`). "Storm/lens research" = the `storm-research` skill's multi-agent briefing pipeline. `ccusage` = `npx ccusage@latest`, local usage stats. ABE = Chrome's App-Bound Encryption. Author names (Takahashi, Mesfin, Chague…) = reviewed papers in `Futures/Strategy Article Reviews.md`. Actionable *recipes* for F2/F3/F4 also live symptom-indexed in `vault-build-and-env` / `vault-config-and-flags` / `vault-debugging-playbook` — this file keeps the story and status; those keep the fix.

## Infrastructure

**F1 — reddit-search CLI built for an API that wouldn't have us (2026-07-02).** A full OAuth read-only Reddit CLI was built by Opus (`~/.local/bin/reddit-search`), then Reddit turned out not to be granting developer API access at all. → Root cause: built before access was confirmed. → Status: tool orphaned (never credentialed, never used); superseded by `rdt-cli` cookie-session route. Lesson: confirm access exists before building the client.

**F2 — Automatic Reddit cookie extraction is impossible on this machine.** `rdt login` browser auto-extraction fails. → Root cause: Chrome 127+ App-Bound Encryption blocks third-party cookie-db reads on macOS — a hard wall, not a permissions bug. → Evidence: verified during setup, 2026-07-02. → Status: settled; manual export via Cookie-Editor is THE path. Don't retry auto-extraction after Chrome updates without checking ABE status first.

**F3 — Playwright "not installed" despite notebooklm-py install.** → Root cause: `uv tool install` isolates the tool venv; the playwright binary isn't global. → Fix that worked: `uv tool run --from notebooklm-py playwright install chromium`. → Status: settled recipe.

**F4 — glm-do broke the moment the session ran Fable (2026-07-03).** All calls returned `Unknown Model`. → Root cause: settings-glm.json mapped sonnet/opus/haiku aliases to glm-5.2 but the headless child inherited the *fable* model id, which z.ai rejects. → Fix: `"model": "glm-5.2"` pinned in both settings-glm files. → Status: fixed, verified. Alias-mapping without a hard pin is fragile to new model tiers.

**F5 — glm-do output silently replaced by Stop-hook responses (2026-07-04).** Six discovery summaries came back as essays about "Rule 5." → Root cause: glm-do invoked with cwd inside `~/Claude`; project-scoped Stop hook loaded into the headless session and its block message became the captured output. → Evidence: identical calls from scratchpad cwd produced correct summaries. → Status: **workaround only** — "neutral cwd" means any directory outside `~/Claude` (the session scratchpad, or `cd "$(mktemp -d)"`); durable fix (glm-do cd-to-tempdir inside the wrapper) is a candidate, not applied. The insidious part: output looked plausible and non-empty.

**F6 — The "20x cache cost bug" that wasn't (2026-07-03).** High-upvote Reddit threads + two GitHub issues described a resume/compaction cache regression as live; the conductor wrote it up as "currently unresolved." → Root cause of the error: over-weighting "no changelog entry" vs. checking issue state. → Evidence: GitHub API showed both issues `closed: completed` three months before our version; ccusage then measured healthy caching (215M read vs 6.7M creation). → Status: settled — NOT a live bug. A different TTL bug (#43566) is real-but-not-planned and only matters under Max Extra-Usage overage.

**F7 — "Superpowers is already installed" phantom (2026-07-03).** A research doc claimed GSD was "redundant with the Superpowers we already run." → Root cause: assumption compounding across writing passes; nobody ran `ls`. → Evidence: `ls ~/.claude/skills/` — never installed. → Status: corrected in the doc. Lesson: any "we already have X" claim gets an `ls` before it gets written down.

**F8 — grill-me installed as a dead stub (2026-07-03).** The installed SKILL.md was a one-line trigger (`Run a /grilling session`) for a companion skill that wasn't installed. → Root cause: repo splits trigger and logic across two skills. → Evidence: subagent's own report flagged it; `grilling/SKILL.md` fetched separately. → Status: both installed; works.

**F9 — Session-limit cascade killed 3 of 5 verification agents mid-storm (2026-07-04).** → Root cause: 10 subagents (5 lenses + 5 verifiers) in one run exhausted the account pool. → Status: known cost profile of storm-research (~9-11 agents/run per its own docs). Mitigation that worked: conductor finishes verification directly with GLM-pipe + grep pattern.

**F15 — The "always-failing" changelog source, a TWO-PART bug (2026-07-04→05).** The idle-research pipeline's Claude Code changelog source failed every run, marked "(glm)" = empty triage. Two independent causes, and fixing only the first (the tempting one) did NOT close it — a real lesson in not declaring victory on the first plausible root cause. → **Cause 1 (content):** `code.claude.com/docs/en/changelog` is a 4MB JS app; the strip regex can't remove script bodies containing `<`, so GLM got minified JavaScript. Fixed by repointing to `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` (clean markdown). **But the next run STILL failed.** → **Cause 2 (size):** that CHANGELOG.md is ~400KB of dense version entries; even capped at the pipeline's 100KB `MAXBYTES`, GLM exceeded the per-call timeout and was killed → empty output → "(glm)" fail. Proven by reproduction: a 12-15KB slice triages in ~30s; the 100KB slice times out. Fixed by adding an optional 4th conf field `TYPE|NAME|URL|CAP` (per-source byte cap) and setting the changelog to 15000. → **Lessons:** (a) a source failing EVERY run is structural, not transient — read what the fetcher actually returns AND time the GLM call; (b) `(glm)` in the failed-source tag means fetch-ok/triage-empty (a size/timeout or content-quality problem), distinct from a fetch failure; (c) fixing the first root cause and re-running is the verification — the second cause only surfaced because the fix was actually re-tested, not assumed.

**F16 — The karpathy CLAUDE.md, A/B tested: REDUNDANT here (2026-07-07).** The viral 188k★ `multica-ai/andrej-karpathy-skills` file (4 principles distilled from Karpathy's Jan-2026 post; no license, not by Karpathy) was skipped-on-metadata in the 07-06 frontier scan, then properly A/B tested on user request (TikTok hype check). Pre-registered trapped coding task (ambiguous mechanism, over-engineering bait, cross-file "10 days" contradiction), two Opus arms: vault-conventions baseline vs same + the 65 karpathy lines. Result: equal cost (~42k tokens each), equal verification; karpathy arm 6 lines leaner but silently-failing on bad input (against the house log-on-reject convention) — and, decisively, **it committed the exact §1 failure the file exists to prevent**: confidently asserted "/feeds 30 works via the bot" without reading the dispatch (which rejects arguments), while the baseline self-flagged its own speculative additions. → Verdict per pre-committed rule: redundant for this vault (the principles already live in CLAUDE.md doctrine, opus-builder, the gauntlets); plausibly valuable for bare setups, hence the stars. → One evidence-derived line added to opus-builder (assumptions discipline / no out-of-scope claims). → Don't re-test without a materially different setup or an n>1 budget.

## Research corrections (claims that entered the vault wrong and were fixed)

**F10 — "No learning curve" inversion.** CFTC paper actually finds learning-via-attrition (losers quit; cohorts still lose). The flat "no learning" claim was corrected in the Mind Over Markets storm report. Cite the nuanced version.

**F11 — Homonym citation.** "Even CME's guide disclaims Market Profile" — the disclaimer was real but belonged to an unrelated precious-metals dashboard named "Market Profile." Removed. Check *which product* a quote is about, not just that the quote exists.

**F12 — Superseded-draft citation.** Gousgounis & Onur pit-closure: 2016 CFTC draft said lumber+treasury cost upticks; the published 2018 JCM version says livestock up, treasury *down*. Cite the published version.

**F13 — Search-synthesis inventions.** `/insights` and `/model opusplan` (claimed Claude Code features) — zero occurrences on the actual support pages. Also two invented stats ("JFM 63% continuation", "Dalton 80% POC-return") discarded during lens research when the cited pages didn't contain them. Search synthesis fabricates specifics; primary fetch is mandatory.

**F14 — 1.1% vs 0.4% (Chague et al.).** The day-trading census figure is 0.4% out-earning a bank teller (US$54/day), not "1.1% beat minimum wage." Corrected 2026-07-04.

## Strategic dead ends (deliberately closed; don't reopen casually)

- **Polymarket 5-minute binaries** — near-random, negative EV after fees; steered away hard in founding docs.
- **Congressional-trades signals for intraday futures** — wrong horizon, wrong instrument.
- **TradingView scraping / unofficial API** — ToS-banned, account-ban risk (see `vault-change-control`).
- **Raw tick-level OFI as a retail signal** — decays in ~1s on E-mini (Takahashi); HFT-only band.
- **claude-mem / GSD / Superpowers adoption** — evaluated, skipped with reasons (memory-philosophy conflict; redundancy; coding-workflow mismatch). Re-open only with a new need, not a new mood.
- **Generic 5-min OHLCV signal families on MNQ** (ORB, liquidity-grab fades, gap fades, volume spikes) — structurally below friction per the Mesfin falsification study (with quality caveats documented in the review).

## When NOT to use this skill

Live triage of a current failure → `vault-debugging-playbook`. Why the system is designed around these scars → `vault-architecture-contract`.

## Provenance and maintenance

Written 2026-07-04 from Changelog.md and session records (git history is too young to hold these — the changelog is the chronicle of record). Additions belong here the day a battle settles; an entry needs symptom, root cause, evidence, status.
