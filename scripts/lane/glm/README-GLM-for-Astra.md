# GLM for the lane account — setup and usage (for Astra; key steps are the user's)

*Written 2026-09-10 by the conductor at the user's request ("give Astra a README on how to set up glm-do, to help with usage rates"). This is a trimmed copy of the conductor's own `glm-do` arrangement: GLM 5.3 through z.ai, driven by Claude Code's `claude -p` in a fully caged, tool-less mode. Nothing here grants any authority; GLM is a text worker you delegate reading to, not a reviewer, verifier, or decision-maker.*

## What GLM is for (and not for)

GLM is cheap and fast. Use it to save your own tokens on **bulk, low-judgment text work**:
- summarize a long document you have already fetched, faithfully, with stated limitations;
- extract facts, definitions, quotes or figures **with locators** (page, line, heading) so you can spot-check;
- produce a first draft (notes, an inventory, a table) from text you hand it;
- classify or tabulate many small records, one line per record, with the record count stated in the prompt.

Never use it to: search or pick sources (it has no tools and no web); verify anything (its output is the thing that needs verifying); make a judgment call; handle credentials or anything private you were not given. Two models agreeing is not proof; you still check load-bearing claims against the original.

Known behaviour on this machine: faithful at volume when handed the text (two real errors in 614k words on one pass; many 10/10 spot-checks), weak at source skepticism (it will accuse a source of fraud on thin evidence), drifts on rule-style texts, and **on long inputs it can hang silently** (a 25-minute silent hang on one 60 KB deck) or **return only part of a list** (23 of 50 records on a 22 KB chunk). Chunk inputs to about 20–25 KB, state the expected record count, and reconcile what came back against what you sent before you read the prose. Every call prints a `[claude-code:unrecognized_model] {"model":"glm-5.3"}` warning on stderr; it is harmless.

## Setup

### Step 1 — the user places the key (user only; never through chat, never in a prompt)
1. In the z.ai console, create a **dedicated** API key for this account if the plan allows a second key (so it can be revoked without touching the conductor's). Otherwise the existing coding-plan key is reused; same weekly quota (10,000 credits/week on the Lite plan; the conductor's usage has been about 3%).
2. As the lane user, copy the three templates beside this README into `~/.claude/`, renaming them without `.template`:
   - `settings-glm.json` (effort high, the default)
   - `settings-glm-max.json` (`--max`)
   - `settings-glm-medium.json` (`--medium`)
3. Open each and replace `PASTE-THE-ZAI-KEY-HERE-THEN-chmod-600` with the key. Then:
   ```bash
   chmod 600 ~/.claude/settings-glm*.json
   ```
   The key lives only in these three files. Nothing else in this package touches it.

**What this exposes, said plainly:** anything running as the lane user, including Codex threads, can read those files. That is inherent in letting Astra call GLM. A dedicated key makes the blast radius one revocation.

### Step 2 — install the wrapper (Astra can do this; it writes only inside the lane home)
```bash
mkdir -p ~/.local/bin
install -m 755 /Users/Shared/lane-glm-setup/lane-glm-do ~/.local/bin/lane-glm-do
command -v claude || echo "Claude Code is not on PATH for this account; install or sign in first"
```
Claude Code must exist for this account (`claude` on PATH). The wrapper uses it only as a transport to z.ai; with `--bare --strict-mcp-config --tools ""` it loads no hooks, plugins, MCP servers, memory or CLAUDE.md, and the settings file denies every built-in tool.

### Step 3 — test
```bash
lane-glm-do "Reply with the single word OK."
```
Expected: `OK` (plus the harmless model warning on stderr). If you get a 401, the settings file's key is wrong or an inherited `ANTHROPIC_BASE_URL` pointed the call at Anthropic instead of z.ai; the wrapper unsets inherited `ANTHROPIC_*` variables for exactly that reason, so check the file first. If the call hangs with no output, the input was too long or the service is parking requests; kill it and retry a smaller chunk.

### If you call it from inside a Codex thread
Codex's own sandbox may block outbound network for shell commands (`sandbox_workspace_write.network_access` in `~/.codex/config.toml`). Test with Step 3 from a thread. If it fails only there, that setting is a widening of what Codex commands can do and is the **user's decision**, not a thing to change on your own.

## How to prompt it

Cold register, faithfulness framing, explicit shape. The conductor's standard opener:
```
Summarize the main claims and any stated limitations in the text below. Be faithful; do not add facts. Quote exact phrases for anything you would rely on, with a locator.

<text>
```
Patterns that work here:
- **Inventories with locators:** "For every definition and theorem in the text, output one line: `page | term | verbatim statement`. Do not paraphrase. State the count at the end."
- **Bounded classification:** "There are 48 records below. Output exactly 48 lines, one per record, in the form `<id> | <class> | <reason quoting the record>`. Do not skip records."
- **Reconciling two sources:** use `--max` and ask for the disagreement stated as `A says / B says / what would settle it`.
- **Fan-out:** several `lane-glm-do ... > out-N.txt &` then `wait`; read the outputs yourself.
- **Never** ask it to "check the source yourself" (it cannot) or to "find" anything.

## What to do with the output
Spot-check quotes against the original with whitespace-tolerant matching (a literal grep once falsely "caught" two correct figures). Treat "SUSPECT" or "fraud" labels as prompts to verify, not findings. Reconcile counts before reading. Keep the digest; discard nothing silently; if a chunk came back short, rerun that chunk smaller, once, then leave it pending.

## Files in this package
`lane-glm-do` (the wrapper), `settings-glm.template.json`, `settings-glm-max.template.json`, `settings-glm-medium.template.json` (each with the key placeholder), this README. Vault copy: `.claude/scripts/lane/glm/`. Shared copy for the lane: `/Users/Shared/lane-glm-setup/`.
