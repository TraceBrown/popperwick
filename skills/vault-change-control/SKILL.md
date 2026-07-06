---
name: vault-change-control
description: Load BEFORE making any change to this vault beyond routine note content — installing tools/skills/plugins, adding credentials or credentialed integrations, modifying CLAUDE.md/settings/hooks, substituting a different tool than the user named, taking any external-facing action, or anything touching live trading. Defines what needs explicit user sign-off, what is freely allowed, the non-negotiables with the incident behind each, and the git/changelog routine.
---

# Vault Change Control

How changes are classified, gated, and recorded in this vault. The vault is `~/Claude` — an Obsidian vault, a git repo, and the working directory of a research-conductor system. "The conductor" throughout means the Claude session operating the vault under CLAUDE.md's instructions — i.e., you, probably a Sonnet- or Opus-class session. This skill exists so you don't need a smarter model to know what you're allowed to do.

## Change classes

| Class | Examples | Gate |
|---|---|---|
| **Routine content** | New/edited notes, reviews, changelog entries, wikilinks, scratchpad files | None. Do it. |
| **Research artifacts** | Storm reports, book-pipeline outputs, Trading Plan rule drafts | None to create — but every research cycle must terminate in a [[Trading Plan]] rule or an explicit stated null (CLAUDE.md Rule 5; a Stop hook enforces this once per session). |
| **Infra config** | `.claude/settings*.json`, hooks, `~/.zshrc` model functions, `glm-do` | Allowed without asking ONLY when both hold: (a) you reproduced the bug yourself this session (not just read about it), and (b) the fix is minimal and reversible. Anything speculative, behavioral, or design-level → ask. Verify before and after; changelog it either way. |
| **Installs** | New CLIs, plugins, skills, packages | **Ask first**, unless the user already approved that specific install this session. Approval of one tool does NOT transfer to a substitute (see incident below). |
| **Credentialed integrations** | Anything needing login, cookie, token, API key | **Hard-gated** — see non-negotiables. |
| **External actions** | Posting, commenting, emailing, publishing, sharing links, any write to the outside world | **Never without explicit per-instance approval** (user-confirmed rule, 2026-07-04). |
| **Live trading** | Placing, sizing, or automating real trades | **Never unprompted, ever** (user-confirmed rule, 2026-07-04). Research, sim, and backtests only. A fresh, explicit ask is required each time anything would touch real money. |

## Non-negotiables, each with its rationale and incident

1. **No credentials inside `~/Claude`, ever.** The vault is git-tracked; a leaked secret in history is permanent. *Incident:* on 2026-07-02, the first `git init` pass caught a z.ai token in plaintext in `MODEL-SWITCHING.md` AND a live API key + TLS cert in an Obsidian plugin's `data.json` — both scrubbed/gitignored minutes before they would have been locked into history. Credentials live outside the vault (`~/.claude/settings-glm.json`, `~/.config/rdt-cli/credential.json`, etc.).
2. **The AI never performs a login/credential step.** `notebooklm login`, browser sign-ins, cookie extraction — user-only, always. *Incident:* the Reddit cookie setup (2026-07-02) — the correct pattern was having the user create `~/.config/rdt-cli/credential.json` themselves so the session-cookie value never passed through chat. Follow that pattern for any credential of similar sensitivity.
3. **Reddit tooling is strictly read-only.** The authenticated `rdt` session technically has write capability (`capabilities: ["read","write"]`); it must never be used for upvote/save/subscribe/comment/post. *Rationale:* the user granted read access; write authority is incidental, not granted.
4. **Never substitute a different tool than the user named without explicit sign-off on the substitution.** *Incident:* 2026-07-02, an Opus dispatch to install a repo the user hadn't literally named was blocked by the safety classifier; the fix was stopping and getting explicit approval for that specific swap. The classifier was right.
5. **No TradingView scraping or unofficial API wrappers.** Explicit, enforced ToS violation — real ban risk on the user's actual charting account. Verified against TradingView's own policy pages 2026-07-02. Official webhook alerts are the only legitimate automation path.
6. **No pirated books/PDFs.** Public-domain, Internet Archive/Open Library lending, Libby, author-hosted copies only. Long-standing project rule.
7. **GLM never searches and never verifies.** GLM 5.2 (`glm-do`) is a tool-less bulk reader. The conductor does source selection and all citation/claim verification. Delegating verification to a tool-less model is a research-integrity violation, not a shortcut.
8. **No live-trading automation, no external publishing** — see table above. Both user-confirmed as hard rules 2026-07-04.

## What does NOT need permission

Reading anything; web search/fetch; running documented read-only diagnostics (`rdt status --json`, `agent-reach doctor --json`, `notebooklm list --json`, `npx ccusage@latest`); GLM delegation; creating scratchpad files; routine vault content; git `status`/`log`/`diff`. Using existing paid-plan capacity (NotebookLM, GLM, Reddit session) is fine — those subscriptions exist to be used.

## The recording routine (how changes become durable)

1. **Wikilinks at write time** — link new/edited notes to related notes in the same turn, not later.
2. **Changelog at day boundary** — do NOT write `Changelog.md` incrementally. At the start of the first session on a new calendar day, write the previous day's entry from session memory, do a linking pass, THEN take the user's prompt. (Exception used in practice: when deliberately parking a large task, write the day's entry at park time while context is hot.)
3. **Git commits when the user asks, or at natural completion points with user awareness.** Before any commit: `git status --short`, inspect anything unexpected, and check no file contains a secret even if the name looks innocent. Snapshot (as of 2026-07-04, re-derive per the maintenance section — don't trust this line): the repo ran ~2 days behind the changelog; that lag is a known weak point, not a convention.

## When NOT to use this skill

For *how to run* things (sessions, pipelines, delegation) use `vault-run-and-operate`. For *why the system is shaped this way* use `vault-architecture-contract`. For what counts as evidence, `vault-validation-and-qa`.

## Provenance and maintenance

Written 2026-07-04 by the departing Fable 5 conductor, from session records and Changelog.md. Re-verify volatile facts:
- Hook still registered: `python3 -c "import json; print(json.load(open('/Users/OWNER/Claude/.claude/settings.json'))['hooks']['Stop'][0]['hooks'][0]['command'])"`
- Reddit still read-only-capable session: `rdt status --json` (check `capabilities`)
- Git lag: `git -C ~/Claude log --oneline -3` vs. Changelog.md's latest dated entry.
