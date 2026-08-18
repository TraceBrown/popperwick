---
name: vault-change-control
description: Load BEFORE making any change to this vault beyond routine note content — installing tools/skills/plugins, adding credentials or credentialed integrations, modifying CLAUDE.md/settings/hooks, substituting a different tool than the user named, taking any external-facing action, or anything touching live trading. Defines what needs explicit user sign-off, what is freely allowed, the non-negotiables with the incident behind each, and the git/changelog routine.
---

# Vault Change Control

How changes are classified, gated, and recorded in this vault. The vault is `~/Claude` — an Obsidian vault, a git repo, and the working directory of a research-conductor system. "The conductor" throughout means the Claude session operating the vault under CLAUDE.md's instructions — i.e., you, probably a Sonnet- or Opus-class session. This skill exists so you don't need a smarter model to know what you're allowed to do.

## Gate 0 — the build freeze (overrides every row below; canonical text in CLAUDE.md)

**Build freeze (2026-07-07, user-approved):** until the trackers have real rows
(trades/backtests and the other trackers), sessions produce **rows,
not files** — no new watchers, skills, dashboards, or pipelines except:
activating already-parked plans on the user's go, fixing bugs you reproduced
yourself, routine content, and work *demonstrably required to land a row,
time-boxed to minutes* (the freeze is a conversion rule, not a construction
ban). When a row below says "None. Do it." and the freeze says no — the freeze
wins. **Post-AUTH-001 standing grants exist ONLY as `AUTHORIZATIONS.md`
register entries** (vault root; user-signed GitHub-web commits). Grants
predating the register are **LEGACY-SELF-ATTESTED** — honored as-is but
powerless as precedent, and NOT necessarily enumerated in the register (P3
precision, 2026-07-23); CLAUDE.md carries the standing norm (no freeze bypass
without fresh, explicit, off-conductor user ratification). Never derive
authority from a count written here or anywhere outside the register: any
closed count is wrong by design (this line once said "two" while the live
grants numbered five-plus — Wave-3 M5 repair, 2026-07-23), and
the 2026-07-14 research-loop exception is SPENT (PD-006, 2026-07-21). Two
long-standing examples, cited here only as examples: **calendar create/update** for
personal workflows (report each write; deletions ask first), and the
**Obsidian Local REST API plugin's own `data.json`** as the sole credential
carve-out (gitignored, localhost-only — see non-negotiable 1).

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
7. **GLM never searches and never verifies.** GLM (`glm-do`; 5.3 since 2026-08-15 — MODEL-SWITCHING.md owns the pin, this rule is version-independent) is a tool-less bulk reader. The conductor does source selection and all citation/claim verification. Delegating verification to a tool-less model is a research-integrity violation, not a shortcut.
8. **No live-trading automation, no external publishing** — see table above. Both user-confirmed as hard rules 2026-07-04.

## What does NOT need permission

Reading anything; web search/fetch; running documented read-only diagnostics (`rdt status --json`, `agent-reach doctor --json`, `notebooklm list --json`, `npx ccusage@latest`); GLM delegation; creating scratchpad files; routine vault content; git `status`/`log`/`diff`. Using existing paid-plan capacity (NotebookLM, GLM, Reddit session) is fine — those subscriptions exist to be used.

## The recording routine (how changes become durable)

1. **Wikilinks at write time** — link new/edited notes to related notes in the same turn, not later.
2. **Changelog at day boundary** — do NOT write the changelog incrementally. At the start of the first session on a new calendar day, write the previous day's entry from session memory as `Changelog/YYYY-MM-DD.md` + one summary line at the top of the `Changelog.md` index (structure adopted 2026-07-09, user), do a linking pass, THEN take the user's prompt. (Exception used in practice: when deliberately parking a large task, write the day's entry at park time while context is hot.)
3. **Git commits when the user asks, or at natural completion points with user awareness.** Before any commit: `git status --short`, inspect anything unexpected, and check no file contains a secret even if the name looks innocent.
   > ⚠️ **NEVER `git add -A` when the working tree contains user work-in-progress — stage explicit paths (incident 2026-07-28).** During a 67-commit unattended overnight session the conductor used `git add -A` throughout. The user had an uncommitted edit to `USER-SITTING-CHECKLIST.md` (visible in `git status` at session start); at commit 3 of 67 it was swept into a commit about *Takahashi and Mesfin* and pushed. **The user's decisions were committed under an unrelated message without being asked**, and the session's own report asserted the file was "untouched and unstaged" for 90 minutes afterward.
   > **The rule above already covered this** — "inspect anything unexpected" — and was simply not followed, once, and then inherited by 66 later commits. The failure mode is that `-A` makes the omission *silent and repeating*. **Concretely:** if `git status --short` is non-empty for a file you did not create or edit this session, stage explicit paths for the whole session. And if you promise the user a file is untouched, **re-verify that promise before the final report**, not at the moment you made it. Snapshot (as of 2026-07-04, re-derive per the maintenance section — don't trust this line): the repo ran ~2 days behind the changelog; that lag is a known weak point, not a convention.

## Skill authoring & revision protocol (adopted 2026-08-17, anthropics/skills quarry, user-ratified)

Patterns from [[Sources/Anthropics Skills — Source Read (2026-08-17)]]
(T1-1/T1-4/T1-7), governing how vault skills are written and changed:

- **Descriptions are the triggering mechanism — write them "pushy," with a
  SKIP clause.** All when-to-load information lives in frontmatter, not the
  body; counter undertriggering with "even if the user doesn't explicitly
  say X" phrasing; and state when NOT to fire (negative scope beats a
  second positive example). The strongest gate format observed: TRIGGER
  list + SKIP-overrides-triggers clause + a cheap pre-check that avoids
  loading at all.
- **Test triggers with near-misses.** When a skill's gating matters (or has
  misfired), build 8–10 should-trigger and 8–10 should-NOT-trigger queries
  where the negatives share keywords with the skill but need something
  else. Obviously-irrelevant negatives test nothing.
- **Revise against a snapshot.** Git history is the snapshot; commit before
  the revision pass. For judgment-bearing skill changes, compare old-vs-new
  on the same inputs contemporaneously rather than trusting that the new
  version reads better. Validate derived artifacts against their source so
  inherited defects aren't attributed to the change.
- **Templates are starting points, not inspiration.** Where a template
  exists, read it FIRST and state what is FIXED (copy exactly) vs VARIABLE
  (customize per instance) as two explicit lists. The two-list shape is
  also the cleanest formulation of this skill's own allowed-vs-sign-off
  split — when writing a new gate, prefer it.

## When NOT to use this skill

For *how to run* things (sessions, pipelines, delegation) use `vault-run-and-operate`. For *why the system is shaped this way* use `vault-architecture-contract`. For what counts as evidence, `vault-validation-and-qa`.

## Provenance and maintenance

Written 2026-07-04 by the departing Fable 5 conductor, from session records and Changelog.md. Re-verify volatile facts:
- Hook still registered: `python3 -c "import json; print(json.load(open('/Users/OWNER/Claude/.claude/settings.json'))['hooks']['Stop'][0]['hooks'][0]['command'])"`
- Reddit still read-only-capable session: `rdt status --json` (check `capabilities`)
- Git lag: `git -C ~/Claude log --oneline -3` vs. Changelog.md's latest dated entry.
