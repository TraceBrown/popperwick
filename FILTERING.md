# How this extract was made

This repository is a filtered projection of a private git repository (the owner's
research vault, about 1,065 commits as of September 2026) that also holds the
owner's research notes and personal material.
The promise of this extract is narrow and checkable: **nothing outside the
published file list exists anywhere in this repository's history**, in content,
paths, commit messages or identities. It is not a promise of unlinkability:
files that were published unchanged keep the same blob hashes as in the private
repository, and commit timestamps were preserved.

## Method

1. **Explicit allow-list.** A manifest of 65 paths was written by hand from the
   private repository's inventory, one file per line, with no directory
   wildcards. Every file on it was read in full by the conductor before
   publication, as was every line that appears only in a historical version.
2. **Fresh clone, one branch.** `git clone --no-local --single-branch` of
   `main`, remote removed, every other ref deleted (the private repository has
   no tags).
3. **`git filter-repo`** with `--paths-from-file` (the manifest), path renames
   out of the private tool folder (`.claude/scripts/` to `scripts/`,
   `.claude/roundtable/` to `roundtable/`, `.claude/skills/` to `skills/`), a
   mailmap that maps the owner's local identities to the GitHub noreply
   address, and literal text replacements applied to every blob and message:
   - the owner's home directory path to `/Users/OWNER`;
   - the launchd label prefix to `com.OWNER.`;
   - the names of two private repositories to `private-vault` and
     `private-share`;
   - the owner's account name in a sudoers line and in three comments to
     `OWNER` or "the conductor account";
   - four short phrases that named private notes or decisions, generalized.
   The replacement list itself is not published because it contains the
   original strings.
4. **Commit messages.** A commit keeps its original message only if the
   original commit changed published files and nothing else, and the message
   was read in full first (17 commits). Every other commit carries a
   mechanical message: the date, the files changed, one sentence saying that
   the original message was not carried because the commit also touched
   private files, and the provenance trailers (`Co-Authored-By: Claude …
   <noreply@anthropic.com>` and `Conduct on …`), which were kept only when they
   matched a strict pattern.
5. **Identity.** Author and committer on every commit are the owner's name with
   the GitHub noreply address. Author and committer dates were preserved, so
   the working pattern of the private repository is visible in this one.

## Gates run before publication

- A fail-closed scanner over every reachable object: refs (exactly one branch,
  no tags, no remote refs), raw commit headers against an identity allow-list,
  every path in history against the manifest, every blob and message against
  secret patterns, the owner's identifiers, and a set of personal-content
  patterns whose hits were each read and adjudicated.
- `gitleaks` over the full history as a second engine.
- `git fsck --full --strict` and `git count-objects`.
- A separate bulk-model screening pass over the complete per-file history
  patches, with every flagged line checked against the source by the
  conductor.
- A push rehearsal into a local bare repository, followed by a fresh clone of
  that repository, scanned again.

## What was held back, and why

- The private trees (the research itself, journals, decisions, consult
  archives, everything personal), by definition.
- Watcher and harvest scripts that read public social feeds, and the two
  process documents that describe them: they carry third-party account
  handles and read poorly out of context.
- The scheduled digest family (Telegram publisher, idle-research runner,
  dashboard generator): tied to the owner's private chat and machine.
- Four trading-domain skills and the provider-wiring document: the owner has
  not decided whether to publish them.
- The writing-conventions skill and the debugging playbook: held for a second
  pass.
- Settings, hooks, launch configurations, credential maps, GLM settings
  templates, PNG previews and session records.

## Known residue

- Wikilinks (`[[…]]`) and paths such as `Journal/…` in the process documents
  point into the private vault and do not resolve here.
- Some scripts call companion scripts that were not published
  (`dashboard_gen.py`, `idle_research_telegram.py`, `health-check.sh`) or read
  configuration from `.claude/` paths that do not exist in this layout.
- `OWNER` placeholders stand where the owner's account path was scrubbed; those
  scripts are not runnable without editing.
- Test fixtures contain invented data (canned seat answers, loopback
  addresses, repeated-digit run ids).

## Updates

Future changes land as a re-export: same manifest, same rules, same gates,
history rewritten again from the private source. Nothing is committed here by
hand except the curated documents in `docs/`, this file and the README.
