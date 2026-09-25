# PopperWick tooling

The tool layer of a private research vault, published as a curated extract.

The vault is an Obsidian folder that one person uses for retail
futures-trading research. It runs as a "conductor" system: a frontier model
(Claude, in the Claude Code CLI) frames the questions, picks the sources,
verifies claims and writes the output, while cheaper headless models do the
volume (GLM for bulk reading; GPT and Kimi for adversarial review). This
repository holds the scripts, the local roundtable web app, the process skills
and curated copies of the governing documents. The research itself and
everything personal stay private. `FILTERING.md` says exactly how this extract
was made, what was checked, and what was held back.

Nearly all of the code and most of the prose here were written by AI models
(Claude as conductor and builder; GPT, Kimi and GLM as reviewers) under the
owner's direction: the owner set the goals, approved each change and signed
off on the decisions. Commit trailers name the model that conducted each
commit.

## What is here

| Path | What it is |
|---|---|
| `roundtable/` | A local single-page web app that puts the three headless model CLIs on one question at the same time, then through structured rounds: independent answers, an anonymized review round, a tagged-order argument, and a decision typed by the human conductor. Four page variants (A, B, the "Decision atlas" C and the "Chamber" D) and a headless test gauntlet of over four hundred checks. |
| `scripts/roundtable.py` | The server half of the roundtable. Python 3, standard library only, with a `--fake` mode that invokes no model. |
| `scripts/consult_manifest.py` | The append-only ledger of model consults: which packet went to which model, what came back, where it is filed. |
| `scripts/domain_canary.py`, `scripts/domain-canary.conf`, `scripts/com.OWNER.domain-canary.plist` | A bounded weekly canary that checks a few research feeds for new candidate papers, with a seen-ledger, throttling-aware failure reporting, and its launchd job definition. |
| `scripts/feeds_digest.sh`, `scripts/papers_digest.sh` | On-demand digest builders for research feeds and arXiv quant-finance listings. They call companion scripts that are not published (see `FILTERING.md`). |
| `scripts/web_crawl.py` | Fetches one DuckDuckGo HTML results page anonymously through headless Chromium and prints the organic results as triage lines. It refuses any other host. |
| `scripts/fence.sh` | The "overnight fence": arms and disarms kernel-level immutability (`chflags uchg`) on canonical files so an unattended session cannot delete or overwrite them. |
| `scripts/mirror-share.sh` | A manual, one-way, allow-listed rsync of a vault subset into a separate working copy, so another agent or machine can read it without being given the vault. |
| `scripts/kimi-lane.sb.reference`, `scripts/lane/` | A macOS Seatbelt profile lineage and the launcher, settings and verification battery for running a consultant model as a separate user with read access to a mirror only and write access to an outbox only. |
| `skills/` | Ten process documents in the Claude Code skill format: how the vault verifies, changes, debugs, designs, measures and remembers. |
| `docs/` | Curated snapshots of the governing documents: the conductor instructions (`CLAUDE.md`), the cross-tool `AGENTS.md`, the conductor quick-start, and the tri-model planning method. |

## Running the roundtable

The server's default page path assumes the private vault's layout, so pass
the page explicitly, as an absolute path:

```bash
ROUNDTABLE_FAKE_DELAY=0.3 python3 scripts/roundtable.py --fake --port 8787 \
  --ui "$PWD/roundtable/variants/C/index.html"
```

Then open `http://127.0.0.1:8787/`. Fake mode answers with canned seats and
writes nothing outside the fake sessions directory (`ROUNDTABLE_FAKE_DIR`,
default under the system temp folder). Live mode expects three wrapper
commands on `PATH` (`gpt-do`, `kimi-do`, `glm-do`); those wrappers are not in
this repository, and `roundtable/README.md` describes what they must accept.

The test gauntlet runs from `roundtable/tests/` against a fake-mode server
(Node 18 or later, no packages):

```bash
cd roundtable/tests
for s in drive fields graft layout reading; do RT_BASE=http://127.0.0.1:8787 node $s.js | grep ^RESULT; done
for s in round4 round5 aesthetics imagined grid; do RT_BASE=http://127.0.0.1:8787 node atlas/$s.js | grep ^RESULT; done
```

`roundtable/tests/README.md` lists the expected counts per suite and the
variants each suite applies to.

## The other scripts

They are published as a record of what was built, not as a kit. Most read
configuration from the private vault's layout, several call companion scripts
that are not here, and every path that named the owner's account was replaced
with `OWNER`. The sandbox profiles and lane files are specific to one machine
and one macOS account arrangement; read them as a design history with its
verification steps, not as security guidance.

## History

The 71 commits are a rewrite of the private repository's history restricted to
these files. Author and committer dates are the originals. Seventeen commits
that touched only published files keep their original messages; the other 54
carry a mechanical message naming the date and files, because the original
message also described private changes. `FILTERING.md` has the details and
the gates that were run.

## Not in this release

Held back for a later pass: the scheduled digest family (a Telegram
publisher, the idle-research runner and the dashboard generator), four
trading-domain skills, the writing-conventions skill, the debugging playbook,
the watcher skills and harvest scripts, and the provider-wiring document.

Nothing in this repository is investment advice. The trading research the
tools serve is not published.

## Licence

No licence has been chosen yet. Until one is added, the default applies: you
may read and study this, and reuse needs the owner's permission.
