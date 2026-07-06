---
name: vault-diagnostics-and-tooling
description: Load when you need to MEASURE the state of this system instead of guessing — token/cost/cache health, tool auth status, backend routing, hook behavior, pipeline output integrity, or an all-up health check. Each diagnostic with its interpretation guide; includes a runnable health-check script in scripts/.
---

# Vault Diagnostics & Tooling

Measure, don't eyeball. Everything below is safe to run without asking — read-only apart from its own throwaway test markers, which each section cleans up. Tool locations: `rdt` and `notebooklm` are on PATH; `agent-reach` requires `source ~/.agent-reach-venv/bin/activate` in the same Bash call; `ccusage` is npx-only. Install provenance: `vault-build-and-env`.

## All-up health check

```bash
bash ~/Claude/.claude/skills/vault-diagnostics-and-tooling/scripts/health-check.sh
```
Runs every check in this skill and prints PASS/WARN/FAIL per line. Run it at session start after any suspected breakage, after any environment change, and before blaming a specific tool.

## Token / cost / cache health

```bash
npx ccusage@latest daily --since YYYYMMDD   # local JSONL only; no credential, no network data exfil
npx ccusage@latest blocks --live            # live burn-rate dashboard
```
**Interpretation:** the number that matters is the cache ratio — `cache read` should dwarf `cache creation` (healthy baseline measured 2026-07-03: 215M read vs 6.7M creation over 3 days). If reads do NOT dominate — flat reads, or creation-heavy days — investigate: idle gaps >5min between calls (cache TTL expiry) or session-restart churn are the usual causes. Dollar figures are API-equivalent estimates — on subscription they proxy limit-burn, not billing.

## Tool auth & routing status (the four JSON status calls)

| Command | Healthy looks like | Unhealthy → |
|---|---|---|
| `rdt status --json` | under `data`: `authenticated: true`, a username, `capabilities: ["read","write"]` | cookie expired → user re-exports the `reddit_session` cookie via the Cookie-Editor browser extension into `~/.config/rdt-cli/credential.json` (never through chat — `vault-debugging-playbook`) |
| `source ~/.agent-reach-venv/bin/activate && agent-reach doctor --json` | `youtube.status: ok` (yt-dlp), `reddit.status: ok` (rdt-cli) | backend swapped upstream — read the message; agent-reach rotates backends |
| `notebooklm list --json` | JSON array of notebooks | auth error → STOP, user-only login |
| `claude mcp list` | `obsidian: uvx mcp-obsidian - ✔ Connected` | reconnect via MCP config |

## Hook diagnostics

```bash
# fire-state probe (harmless; cleans up after itself). The hook's real stdin is the
# full Stop-event JSON, but it only parses session_id — so this minimal input is faithful:
echo '{"session_id":"diagtest"}' | bash ~/Claude/.claude/hooks/close-the-loop.sh; echo "exit=$?"
rm -f /tmp/claude-close-loop-diagtest
# exit 0 = Trading Plan newer than all watched research files (Futures/, storm-reports/,
#          Learning/{Notes,Quiz,Flashcards}/ — .md/.html only), or already reminded
# exit 2 = research files newer → loop open; expect the reminder at session Stop
ls /tmp/claude-close-loop-* 2>/dev/null    # which sessions were already reminded
```

## Pipeline output integrity

```bash
# NotebookLM artifacts: existence + size + book-specificity
for f in ~/Claude/Learning/Notes/*.md; do printf "%6d  %s\n" "$(wc -c < "$f")" "$f"; done
grep -L "#flashcards" ~/Claude/Learning/Flashcards/*.md   # lists any flashcard file MISSING the required tag
# git drift (history-of-record vs repo):
git -C ~/Claude log -1 --format="last commit: %cd" --date=short; grep -m1 "^## 20" ~/Claude/Changelog.md
```

## Verification-grade fetch checks

(Procedure home: `vault-validation-and-qa` — kept here as quick reference because they're measurement commands.)

```bash
# is a GitHub issue actually fixed? (don't trust Reddit's version)
curl -s https://api.github.com/repos/<owner>/<repo>/issues/<N> | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['state'], d.get('state_reason'), d.get('closed_at'))"
# does a page really contain the quote?
grep -c "exact phrase" fetched.html   # 0 → loosen pattern (tags/ligatures) before concluding absence
```

## When NOT to use this skill

Interpreting a failure you've already localized → `vault-debugging-playbook`. Whether output *content* is trustworthy → `vault-validation-and-qa`.

## Provenance and maintenance

Written 2026-07-04. The script re-verifies itself (it IS the re-verification command). If a status call's output schema changes upstream, update both this file and `scripts/health-check.sh` together.
