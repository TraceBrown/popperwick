# GLM for the lane account — setup and usage (for Astra; the key step is the user's)

*Written 2026-09-10 by the conductor at the user's request ("give Astra a README on how to set up glm-do, to help with usage rates"). **Version 2:** the wrapper is a direct HTTPS call to z.ai's OpenAI-style chat endpoint (`https://api.z.ai/api/coding/paas/v4/chat/completions`), verified with the user's coding-plan key. It needs no Claude Code and no Codex: text in, text out, nothing else is possible. Why not Claude Code as transport (the conductor's own `glm-do` does that): it works, but drags a whole agent CLI in to relay text and then cages its tools away. Why not Codex: Codex speaks only the Responses protocol to custom providers and z.ai serves no `/responses` endpoint (probed 2026-09-10: 404 on both bases). Nothing here grants any authority; GLM is a text worker you delegate reading to, not a reviewer, verifier, or decision-maker.*

## What GLM is for (and not for)

GLM is cheap and fast. Use it to save your own tokens on **bulk, low-judgment text work**:
- summarize a long document you have already fetched, faithfully, with stated limitations;
- extract facts, definitions, quotes or figures **with locators** (page, line, heading) so you can spot-check;
- produce a first draft (notes, an inventory, a table) from text you hand it;
- classify or tabulate many small records, one line per record, with the record count stated in the prompt.

Never use it to: search or pick sources (it has no tools and no web); verify anything (its output is the thing that needs verifying); make a judgment call; handle credentials or anything private you were not given. Two models agreeing is not proof; you still check load-bearing claims against the original.

Known behaviour on this machine: faithful at volume when handed the text (two real errors in 614k words on one pass; many 10/10 spot-checks), weak at source skepticism (it will accuse a source of fraud on thin evidence), drifts on rule-style texts, and **on long inputs it can hang silently** (a 25-minute silent hang on one 60 KB deck) or **return only part of a list** (23 of 50 records on a 22 KB chunk). Chunk inputs to about 20–25 KB, state the expected record count, and reconcile what came back against what you sent before you read the prose. Every call prints one bracketed status line on stderr with the token counts; that is the only noise.

## Setup

### Step 1 — the user places the key (user only; never through chat, never in a prompt)
1. In the z.ai console, create a **dedicated** API key for this account if the plan allows a second key (so it can be revoked without touching the conductor's). Otherwise the existing coding-plan key is reused; same weekly quota (10,000 credits/week on the Lite plan; the conductor's usage has run about 3%).
2. As the lane user:
   ```bash
   mkdir -p ~/.credentials && chmod 700 ~/.credentials
   # paste the key into ~/.credentials/zai.key with TextEdit or pbpaste — one line, nothing else
   chmod 600 ~/.credentials/zai.key
   ```
   The wrapper refuses to run unless that file is mode 600. The key lives nowhere else.

**What this exposes, said plainly:** anything running as the lane user, including Codex threads, can read that file. That is inherent in letting Astra call GLM. A dedicated key makes the blast radius one revocation.

### Step 2 — install the wrapper (Astra can do this; it writes only inside the lane home)
```bash
mkdir -p ~/.local/bin
install -m 755 /Users/Shared/lane-glm-setup/lane-glm-do ~/.local/bin/lane-glm-do
```
Dependencies: `/usr/bin/curl` and `/usr/bin/python3` (both ship with macOS). No Claude Code, no Codex, no MCP.

### Step 3 — test
```bash
lane-glm-do "Reply with the single word OK."
```
Expected: `OK` on stdout and one bracketed status line on stderr (`model=glm-5.3 finish=stop in=… out=…`), in about ten seconds. On the conductor's account this exact test returned in 10 s at high effort and 4.5 s at `--low`.
- `HTTP 401`: the key file is wrong.
- `HTTP 429 … Insufficient balance`: the call went to the pay-per-token base; the wrapper's endpoint is the coding-plan base, so this means the key is not a coding-plan key.
- `key file … must be mode 600`: run the chmod in step 1.
- Empty content with `finish=length`: the model spent its output on reasoning; retry with `--low`, a smaller input, or `LANE_GLM_MAX_TOKENS=32000`.
- Silence for minutes: the input was too long or the service is parking requests; the wrapper gives up after 30 minutes (`LANE_GLM_TIMEOUT`); kill it and retry a smaller chunk.

### If you call it from inside a Codex thread
Codex's own sandbox may block outbound network for shell commands (`sandbox_workspace_write.network_access` in `~/.codex/config.toml`). Run Step 3 from a thread. If it fails only there, that setting is a widening of what Codex commands can do and is the **user's decision**, not a thing to change on your own.

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
`lane-glm-do` (the wrapper; `--max` / `--low` select `reasoning_effort` with thinking on; stdin is appended as material if data arrives within two seconds) and this README. Vault copy: `.claude/scripts/lane/glm/`. Shared copy for the lane: `/Users/Shared/lane-glm-setup/`. Test record: conductor's account, 2026-09-10, four cases (default, `--low` with piped text, open-but-silent stdin, wrong key mode) all as expected.
