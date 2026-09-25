# Research conductor: a smart model drives GLM

*Curated snapshot (2026-09-25) of the private vault's `RESEARCH-CONDUCTOR.md`.
The Obsidian cross-links at the top of the original were removed.*

A **conductor** is an Anthropic session (a claude.ai subscription, no API key,
flat cost) acting as lead researcher. It delegates bulk, low-judgment work
(reading and summarizing sources) to **GLM 5.3**, a cheap high-volume worker,
while keeping the thinking, judging and synthesizing for itself.

No proxy, no extra infrastructure: Anthropic talks direct to Anthropic, GLM
talks direct to z.ai. The conductor simply calls GLM as a command-line tool.

## Quick start

1. In a terminal, run `source ~/.zshrc` once (new terminals load it
   automatically).
2. Run **`conductor`**. This starts an Anthropic lead-researcher session in the
   vault, which auto-loads its workflow from the vault's `CLAUDE.md`.
3. Give it a research task. It will search and vet sources itself, delegate the
   bulk reading and summarizing to GLM, then verify every citation and
   synthesize the result.

## Commands

| You want… | Do this |
|---|---|
| Start a conductor session | `conductor` (Anthropic session in the vault) |
| Delegate a task to GLM manually | `glm-do "Summarize the text below: …"` |
| Feed GLM a large file | `cat note.md \| glm-do` |
| Open the vault in Obsidian | it *is* the vault; graph, backlinks and flashcards all work on what the conductor writes |

## Division of labor

| Work | Who | Why |
|---|---|---|
| Framing the question, deciding what to investigate | Conductor | Needs judgment |
| Web search and discovery, choosing which sources matter | Conductor | It has the search tools and vets quality |
| Reading and summarizing documents, extracting facts and quotes, first drafts | GLM (`glm-do`) | Cheap, fast, high volume |
| Verifying claims and citations, resolving contradictions | Conductor | Research integrity; never delegated |
| Final synthesis and the written output | Conductor | Needs the best reasoning |

## How delegation works

GLM runs headless with no tools, so the conductor fetches material and hands
GLM plain text to crunch, preferably piped (`curl -s "$URL" | glm-do "…"`) so
the raw bytes never enter the conductor's own context. That keeps things simple
(no permission prompts, no tool-flag guessing) and means the conductor's own
search tools do all the discovery; GLM never needs web access.

### Fan out for breadth

Research is read-many. The conductor can launch several GLM workers at once:

```bash
glm-do "Summarize source A: …" > /tmp/a.txt &
glm-do "Summarize source B: …" > /tmp/b.txt &
glm-do "Summarize source C: …" > /tmp/c.txt &
wait
```

Then it reads the summaries, cross-checks them, and synthesizes.

## The rules (enforced by the conductor instructions)

1. **Verify everything GLM returns.** Treat it as a draft; spot-check quotes
   and every citation against the original source.
2. **The conductor does the searching.** Don't ask GLM to find sources.
3. **Attribute honestly.** Every claim traces to a real, checked source.
4. **Push volume down, keep judgment up.** "Read and compress" goes to GLM;
   "decide what matters" or "is this true" stays with the conductor.

## Files

| File | Purpose |
|---|---|
| `~/.zshrc` | Defines the `conductor` (and `glm` / `anth`) shell functions |
| `~/.local/bin/glm-do` | Runs a headless GLM task and prints the result |
| `<vault>/CLAUDE.md` | The conductor's workflow and rules (auto-loaded) |
| `~/.claude/settings-glm.json` | GLM/z.ai config used by `glm-do` (holds the key; never inside the vault) |
| `~/.claude/settings-anthropic.json` | Anthropic override used by `conductor` |

## Where this fits

This is the low-infrastructure version. It keeps Anthropic use on the flat
subscription and needs no background service. True in-session parallel
subagents (Anthropic main plus GLM subagents in one session) would need a
router proxy and probably a paid API key; that path was never built.
