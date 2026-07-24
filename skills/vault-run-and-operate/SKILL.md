---
name: vault-run-and-operate
description: Load at the start of any conductor session in this vault, or when running its standard workflows — the session-start routine, GLM delegation and fan-out patterns, the book pipeline, Reddit/YouTube/web research commands, storm/roast/grilling triggers, and where every output lands. The day-to-day operating manual.
---

# Vault Run & Operate

The operating manual for a conductor session in `~/Claude`. Audience: a cold-starting Sonnet/Opus session with full repo access and zero session memory.

**Terms used throughout:** a **conductor session** is any Claude Code session working in `~/Claude` under CLAUDE.md's instructions (that's you). **`glm-do`** is a bash wrapper at `~/.local/bin/glm-do` that sends one headless text task to the cheap GLM 5.2 model and prints the result — GLM has no tools, so you always pipe content IN. **`rdt`** is a standalone Reddit CLI (pipx-installed, cookie-authenticated). **SCRATCHPAD** means the session-specific scratchpad directory listed in your system prompt ("Scratchpad Directory"); if none is listed, `mktemp -d`. **F-codes** (F5, F9…) are incident entries in `vault-failure-archaeology`.

## Session-start routine

0. **Succession + freeze check (2026-07-10):** if you are a new conductor (or
   unsure), read `HANDOFF - Conductor Succession.md` at vault root FIRST —
   who conducts, the bookend review protocol, and the first-30-tasks log all
   live there. The **build freeze** (rows, not files — canonical text in
   CLAUDE.md) binds every session; `vault-change-control` Gate 0 mirrors it.
1. If the date changed since the last dated Changelog entry: write yesterday's entry FIRST (from context/HANDOFF files, don't re-read everything), do a quick wikilink pass, then take the user's prompt (CLAUDE.md day-boundary rule).
2. Check for a `HANDOFF - *.md` at vault root — a parked task with a pickup queue takes precedence over guessing (skip any whose title or banner says COMPLETED/DONE).
3. `git -C ~/Claude status --short` — know what's uncommitted before you add to it.
4. Expect the **Stop hook** to fire once per session if research files are newer than the Trading Plan — answer with a rule or an explicit stated null, never a fabricated rule.

## Git remote (since 2026-07-06)

Private backup remote exists (`origin` → github.com/OWNER/private-vault).
**After any commit, `git push`** — a commit that only exists locally protects
nothing. Never force-push; never change repo visibility.

## GLM delegation (the bread-and-butter pattern)

```bash
cd <SCRATCHPAD>                              # NEVER vault cwd — hook contamination (F5)
curl -sL -A "Mozilla/5.0" "$URL" -o page.html    # you fetch; GLM has no tools
sed -E 's/<script[^>]*>[^<]*<\/script>//g; s/<[^>]+>/ /g' page.html | glm-do 'Extract exactly ... Under 400 words.' > out.txt
# fan-out (parallel):
cat a.txt | glm-do "$PROMPT" > sum_a.txt & cat b.txt | glm-do "$PROMPT" > sum_b.txt & wait
# harder reasoning: glm-do --max "..."
```
Rules: pipe raw bytes (don't read big sources into your own context first); verify every load-bearing output claim by grepping the raw file (`vault-validation-and-qa` Recipe 1); long jobs need explicit Bash timeouts (default 2min kills them).

## Research commands that work (all proven)

```bash
# YouTube transcript (curl/WebFetch are blocked for YT):
source ~/.agent-reach-venv/bin/activate
yt-dlp --write-sub --write-auto-sub --sub-lang en --skip-download -o "name_%(id)s" "https://youtu.be/<ID>"
grep -v "^WEBVTT\|-->" name_*.vtt | sed -E 's/<[^>]+>//g' | awk '!seen[$0]++' > clean.txt   # dedupe captions

# Reddit (READ-ONLY, always):
rdt search "query" --limit 10        # also: rdt read POST_ID / rdt sub NAME / rdt popular
rdt status --json                    # auth check

# Platform routing map:
source ~/.agent-reach-venv/bin/activate && agent-reach doctor --json
# exact per-platform syntax: ~/.claude/skills/agent-reach/references/{social,video,search,...}.md — consult, don't guess

# Papers: fetch PDF → pdftotext → GLM. SSRN blocks bots; hunt author-hosted mirrors.
pdftotext paper.pdf paper.txt && cat paper.txt | glm-do "$EXTRACT_PROMPT"
```

## The book pipeline (Learning/)

1. User drops owned files in `Learning/_source_books/` (or you copy from ~/Downloads with clean slugs, on request).
2. General pass: `cd ~/Claude/Learning && python3 notebooklm_batch.py` — idempotent, self-pacing, one notebook per file → `Notes/<slug>.md`, `Quiz/<slug>-quiz.md`, `Flashcards/<slug>-flashcards.md`. Books sequential, never parallel (rate limits).
3. Focused/hard pass (the two-pass convention — a second, domain-targeted pass per book): reuse the same notebook (`notebooklm list --json`, match title; NO re-upload), then `notebooklm generate report --format study-guide "<focus description>"`, `notebooklm generate quiz --difficulty hard "<desc>"`, `notebooklm generate flashcards --difficulty hard "<desc>"`, each `--wait --timeout 600 --retry 4`, ~15s apart; download with `notebooklm download <type> <dest> --latest --force` to `<slug>-<focus>*` files. Precedent + cross-linking style: `Learning/Notes/flash-boys-hft-mechanics.md`.
4. QA per `vault-validation-and-qa` Recipe 4. Flashcards must be spaced-repetition format (`#flashcards` tag, multiline `?` separator).
5. **Login is user-only. Never `notebooklm login`.**

## Heavier instruments

- `storm-research <topic>` — 4-phase verified briefing → `storm-reports/<slug>-briefing.html`. Costs ~9-11 subagents; can exhaust the session pool (F9) — have the GLM-pipe fallback ready for verification.
- `/roast <idea>` — 5-persona stress test with GO/RESHAPE/KILL verdict.
- `grilling` — pre-work interview for large ambiguous tasks.
- Fable audits — user-triggered via `/model claude-fable-5`; prompt pattern that worked: context/why → negative constraints → prioritized tasks → delegation instructions → "verdict + one-line why + citation" output shape. Never ask Fable to explain its reasoning (triggers refusal/rerouting).
- Fable discipline (2026-07-06 frontier scan, community-cross-confirmed): effort `high` is the sweet spot; `xhigh` only for architecture/migration/final-review-class judgment; hand it a written spec, ask for "conclusion, evidence, tradeoffs, risks, next action"; frame security topics defensively ("authorized, remediation") or expect refusal/reroute. Quota shape: Fable owns planning + adversarial review; mechanical prep and edits go to cheaper models first ("Fable sandwich"). Post-2026-07-07 Fable bills as usage credits — conserve accordingly.

## Ops dashboard (added 2026-07-06)

Read-only status page at `http://<tailnet-ip>:8377` — **tailnet-IP bind ONLY;
LAN serving CLOSED per PD-005 (2026-07-21; the "LAN + Tailscale" line this
replaced was itself an audit gap). Verified live 2026-07-23: listener on the
tailnet CGNAT address only. Do not widen the bind without a fresh user
ruling.** Two launchd
units: `com.OWNER.dashboard-gen` (re-renders `~/Claude/.claude/dashboard/index.html`
from existing pipeline state every 5 min — pure local reads + one 10-min-cached
z.ai quota GET; never runs the pipeline, never calls GLM) and
`com.OWNER.dashboard-web` (KeepAlive `python3 -m http.server` via
`dashboard-web.sh`, serves ONLY the generated site dir). Bind/port in
`dashboard.conf`; after editing: `launchctl kickstart -k gui/$UID/com.OWNER.dashboard-web`.
Invariants: no secrets in the site dir, all external text HTML-escaped in
`dashboard_gen.py`, commands stay in Telegram — the page is eyes only. Debug:
`.claude/scripts/dashboard-{gen,web}.launchd.err`, or run `dashboard_gen.py` by hand.

## Where outputs land

| Output | Home |
|---|---|
| Paper/article reviews | `Futures/Strategy Article Reviews.md` (append, follow its format) |
| Falsifiable rules / nulls | `Journal/Trading Plan.md` |
| Trade/backtest evidence | `Journal/Trades/`, `Journal/Backtests/` (naming: `YYYY-MM-DD-rule-name.ext`) |
| Storm reports | `storm-reports/` |
| Book study artifacts | `Learning/{Notes,Quiz,Flashcards}/` |
| Temp/intermediate | session scratchpad ONLY — never `/tmp`, never the vault |
| Day summary | `Changelog/YYYY-MM-DD.md` day file + one index line at the top of root `Changelog.md` (day-boundary rule; 2026-07-09 structure) |

## Imported craft — context-economy delegation (2026-07-24, from the Kimi plugin-review corpus — [[Sources/Kimi Plugin-Skill Review (2026-07-24)]])

Everything pasted into a dispatch prompt stays resident in the conductor's context forever. For multi-dispatch work (builder rounds, tri-model waves, fan-outs):
- **Briefs and reports travel as FILES**, not prompt paste — the dispatch carries a path; the worker writes its report to a file and returns ≤15 lines (status, commits/paths, one-line result). The conductor reads the report file only when adjudicating it.
- **Keep a durable progress ledger** for any sequence longer than ~3 dispatches (which steps are done, verified, blocked — one line each). After context compaction, **trust the ledger and git log over your own recollection** — the upstream corpus documents controllers re-dispatching entire completed sequences after losing their place, their single most expensive observed failure.
- Package diffs/artifacts for reviewers by explicit range (base..head), never "last commit" shorthand — multi-commit tasks silently truncate.

## Imported craft — finance-directory round (2026-07-24, [[Sources/ChatGPT Plugin Directory — Finance Review (2026-07-24)]]; Sol-narrowed; deweaponized)

**Four-line human-facing run summary** — for reports to the user, never
prepended to raw logs, JSON, or machine output: What ran / Verified
observation / Bounded interpretation or status / Next gate and owner. An
invalid or failed run says "no inference" in the third line — never a soft
reading of partial output.

## When NOT to use this skill

Permission questions → `vault-change-control`. Broken tools → `vault-debugging-playbook`. Judging research quality → `vault-research-methodology` / `vault-validation-and-qa`.

## Provenance and maintenance

Written 2026-07-04; every command block executed successfully in real sessions within the prior 72h. Re-verify fastest-drifting bits: `agent-reach doctor --json` (backends get swapped upstream), `rdt status --json` (cookie expiry), the batch script's flags (`python3 ~/Claude/Learning/notebooklm_batch.py --help`).
