# Roundtable

A local, single-page instrument for putting the vault's three headless model
CLIs — **GPT** (`gpt-do`), **Kimi** (`kimi-do`), **GLM** (`glm-do`) — on one
question at the same time, and then through structured rounds. Server:
`.claude/scripts/roundtable.py` (Python 3, stdlib only). UI:
`.claude/roundtable/index.html` (one file, no JS dependencies, no external
requests) — or any page passed to `--ui`. Built 2026-09-02 on the user's
in-chat ratification; the **v2 API** (multi-round sessions, per-seat knobs,
N-seat relay, persona debate, conductor decision) landed the same day,
backward compatible with the v1 page.

## What this is NOT

A roundtable session is a **DEBATE RECORD, not a review**. It carries no
closure authority under the vault's reviewer matrix (`AUTHORIZATIONS.md`,
AUTH-001 item 4); a model's ranking here is not a verdict; only the
conductor's written synthesis, filed in the usual archives, is. There is no
model chairman — no endpoint asks a model to adjudicate, the persona sequence
deliberately ends at `done` with no judge step, and the two judgment-bearing
fields in the file (`notes`, `decision`) are typed by the conductor. Two seats
agreeing is not truth; three seats agreeing is not truth either (GLM and any
GLM-lineage seat are not independent — MODEL-SWITCHING.md).

## Run it

```bash
cd ~/Claude
python3 .claude/scripts/roundtable.py --fake      # canned seats, no model called
python3 .claude/scripts/roundtable.py             # live seats
```

Then open `http://127.0.0.1:8787/` (printed on start). Flags:

| flag | meaning |
|---|---|
| `--port N` | default 8787 |
| `--fake` | canned seats; **no CLI is invoked** and nothing is written into the vault |
| `--sessions-dir PATH` | override the real sessions directory (ignored in `--fake`) |
| `--ui PATH` | page to serve at `/` — absolute, or relative to the vault. Default `.claude/roundtable/index.html`. The served file gets the same `__ROUNDTABLE_TOKEN__` injection; a missing file answers **500 with the path** instead of crashing |

`.claude/launch.json` carries four Browser-pane configurations: `roundtable-fake`
and `roundtable` (v1 page, 8787), and `roundtable-v2a-fake` (8787,
`variants/A/index.html`) / `roundtable-v2b-fake` (8788, `variants/B/index.html`)
for the two v2 page variants.

Fake-mode test hooks (env, no effect on a live run): `ROUNDTABLE_FAKE_DIR`
moves the fake sessions directory; `ROUNDTABLE_FAKE_DELAY` sets the seconds per
canned call (default 1.5–4.0 random) so a gauntlet runs in seconds.

## Modes and stages

A session has a **mode**, fixed at creation, and holds many **rounds**; every
stage below belongs to one round.

**`roundtable`**

1. **Stage 1 — independent answers.** Every enabled seat gets the *same*
   packet and answers blind, in parallel. No seat sees another's answer, and
   the packet says so.
2. **Disagreements.** One reader call (`protocol.reader_seat`/`reader_tier`,
   default `glm`/`high`) extracts contradictions and agreements from all
   stage-1 answers with exact quotes, and is told not to say who is right — a
   reader task, not a judgment. With `anonymize.disagreements` on, the answers
   are labelled "Response A/B/C" and the letter→seat map is kept in the record
   instead of in the packet.
3. **Review round — anonymized by default.** Each reviewer sees every answer,
   its own included, shuffled by a `random.SystemRandom` permutation
   **generated per reviewer** and labelled "Response A", "Response B", … the
   map is kept server-side. With `anonymize.review` off, nothing is shuffled
   and the author is named beside the letter. The ranked list is parsed
   loosely; if it will not parse, `ranking_seats` is `null` and the raw text
   stands — the server never invents a ranking.
4. **Relay (argue, generalized).** 2..N seats alternate in a chosen order for
   1–5 full cycles on one topic; seats not in the order stay silent and their
   answers never enter the packet. Each turn gets the ordered seats' stage-1
   answers plus the relay so far. With `stop_on_error` (default on) the first
   error/timeout/cancel ends the run.
5. **Rerun.** One seat re-answers **the same stage-1 packet**; the new answer
   becomes current and the superseded one moves into `reruns`.

**`persona`** — three seats with frozen charters, exactly one each of `bull` /
`bear` / `risk` on three different seats (anything else is a 400). The sequence
is frozen: `briefs` (stage 1, each seat's charter prefixed to its packet) →
`rebuttal` (bull then bear, one turn each, on the opposing brief) → `risk` (the
risk seat, one turn, on both briefs and both rebuttals: exposures, missing
evidence, invalidation conditions, decision gates — explicitly told not to pick
a winner) → `answers` (bull then bear answer the risk challenges) → `done`.
**There is no judge step.** The verdict is `POST /api/decision`, typed by the
conductor: `select` / `hold` / `reject`, rationale, and the dissent kept on the
record.

Every packet states a word bound (`protocol.bounds`: 600 / 350 / 250 by
default) — not decoration: `kimi-do` on a long unbounded packet has twice
returned `finish=max_tokens` with EMPTY content (MODEL-SWITCHING.md,
2026-09-02), the whole output budget having gone into reasoning.

## Allow-lists (the only settings a client may set)

`GET /api/config` publishes all of them, so a page discovers the options rather
than hard-coding them. A knob only ever selects a value for a fixed, named
environment variable: **no argv and no env var is ever built from client
input**. Anything else in a body is a 400 naming the field (e.g.
`members.gpt.effort: must be one of low, medium, high, xhigh`).

| where | setting | values |
|---|---|---|
| gpt | `tier` | `luna` \| `sol` |
| gpt | `effort` | `low` \| `medium` \| `high` \| `xhigh` → `GPT_DO_EFFORT` (omitted when null) |
| kimi | `tier` | `k3` |
| kimi | `max_tokens` | 2000–64000 → `KIMI_DO_MAX_TOKENS` (per-stage default when null) |
| glm | `tier` | `high` \| `max` |
| any seat | `timeout_s` | 60–3600 (default: luna 900, sol 2400, k3 1500, glm 900); also `KIMI_DO_TOTAL_TIMEOUT` |
| persona seat | `role`, `charter` | one each of bull/bear/risk; a non-empty charter is **required** |
| protocol | `reader_seat` / `reader_tier` | an enabled seat / one of its tiers (default `glm` + its tier) |
| protocol | `anonymize.review` / `anonymize.disagreements` | default `true` / `false` |
| protocol | `bounds.stage1` / `.review` / `.relay` | 100–2000 / 100–1000 / 100–1000 (600 / 350 / 250) |
| protocol | `stop_on_error`, `live_log` | default `true`, `true` (`false` = no live-log tee) |
| relay | `turns` | 1–5 |

## Seat plumbing

Established by reading the three wrappers, not by assumption:

| seat | argv | prompt in | header | default timeout |
|---|---|---|---|---|
| gpt | `gpt-do --luna` / `gpt-do --sol` | stdin | stdout line 1, `[gpt-do: model=… tier=… effort=…]` | 900 s / 2400 s |
| kimi | `kimi-do` (k3) | stdin | **stderr**, `kimi-do: served=… finish=… in=… out=…` | 1500 s |
| glm | `glm-do` / `glm-do --max` | stdin | none — the UI says "(no CLI header)" | 900 s |

Every call: no shell, argv from a fixed table, packet on stdin, `cwd` a fresh
`mkdtemp` **outside the vault** (neutral-cwd rule), own process group so Cancel
can `killpg` it, stdout and stderr captured separately, no credential read or
passed. Kimi gets `KIMI_DO_MAX_TOKENS` (the member's `max_tokens`, else per
stage: 16000 stage 1 / rerun, 6000 review, 8000 relay, 16000 disagreements) and
`KIMI_DO_TOTAL_TIMEOUT` = the seat timeout, so its own watchdog fires with
ours.

**Live-log tee (house convention).** Every call appends a banner plus raw
stdout and stderr to `~/sol-live.log` / `~/kimi-live.log` / `~/glm-live.log`,
append mode, never truncated:

```
===== roundtable <session_id> <stage> <seat>/<tier> <ISO-8601 local time> =====
```

In fake mode these become `fake-*.log` inside the fake sessions directory, so a
test run cannot pollute the pane the user tails. `protocol.live_log: false`
turns the tee off for that session.

## Session file (schema 2)

`<sessions-dir>/<YYYY-MM-DD-HHMMSS>-<slug>-<id8>.json`, written atomically
(temp file + `os.replace`); default `.claude/roundtable/sessions/`. Fake
sessions go to `$TMPDIR/roundtable-fake-sessions/`, carry `"fake": true`, and
the UI shows a persistent "FAKE SEATS — no model was called" banner.

```
schema: 2, id, created, fake, title, mode: roundtable|persona,
members:  { seat: { tier, effort, max_tokens, timeout_s, role, charter, charter_sha256 } },
protocol: { reader_seat, reader_tier, anonymize: { review, disagreements },
            bounds: { stage1, review, relay }, stop_on_error, live_log },
effective_config_sha256,   # sha256 of canonical JSON of {members, protocol},
                           # frozen at creation and NEVER recomputed
rounds: [ { index, question, context, asked_at,
            stage1: { seat: result }, reruns: [ { seat, result } ],
            disagreements: result|null, disagreements_history: [],
            review: { mapping_per_reviewer, results }, review_history: [],
            relays: [ { run_id, step, order: [seats], turns, prompt,
                        entries: [ result + seat ], status } ] } ],
persona_state: { step_index, steps, done } | null,
decision: { stance, rationale, dissent, saved_at } | null,
notes, exported: { md, json }
```

`result` = `{ tier, packet, text, header, stderr_tail, elapsed_s, exit_code,
timed_out, cancelled, status, run_id, started_at }` (+ `ranking_letters` /
`ranking_seats` on reviews, `mapping` on an anonymized disagreements run).

**Every packet sent to a model is stored verbatim** — a session is only
evidence if the exact prompt is recoverable.

**Schema-1 files still load**, migrated *in memory* into the shape above (one
round, `migrated_from: 1`, `effective_config_sha256: null` — that session never
ran under a v2 config, and a hash for it would be an invented fact). The file
is left exactly as written until something mutates it.

**The v1 page keeps working unchanged.** `GET /api/session/<id>` serves the
schema-2 record *plus* a projection of the latest round under the v1 field
names (`question`, `context`, `seats`, `disagreements`, `review`, `argue` with
`rounds`/`turns`, `exported_md_path`); relay turns also publish legacy
`argue_turn` / `argue_done` events and `/api/config` keeps `timeout_s` beside
the v2 `timeout_default`. **A v2 page must ignore the legacy aliases**, or it
counts every relay turn twice.

## Endpoints

GETs: `/api/config`, `/api/sessions` (newest first: `id, created, title, mode,
fake, rounds` + `question` for the v1 drawer), `/api/session/<id>`,
`/api/events?id=<id>` (SSE, keepalive every 15 s).

POSTs (JSON bodies): `/api/session/new` `{title?, mode, members, protocol?}` →
`{id}` (no model call), `/api/round` `{id, question, context?}` → `{round}`,
`/api/disagreements` `{id, round?}`, `/api/review` `{id, round?, reviewers?}`,
`/api/relay` `{id, round?, order:[2..N], turns:1..5, prompt}`,
`/api/persona/step` `{id}`, `/api/decision` `{id, decision}`, `/api/rerun`
`{id, round?, seat}`, `/api/cancel` `{id, seat?}`, `/api/notes` `{id, notes}`,
`/api/export` `{id, format: md|json}` → `{path}`.

Legacy: `/api/ask` = `session/new` + `round` in one call, returning `{id}`;
`/api/argue` = `/api/relay` with exactly two seats and `rounds` instead of
`turns`. `round` defaults to the latest round everywhere.

SSE event types: `round_started`, `seat_started`, `seat_done`, `seat_error`,
`disagreements_done`, `review_done`, `relay_turn`, `relay_done`, `rerun_done`,
`persona_step_done`, `cancelled`, `resync`, plus the legacy `argue_turn` /
`argue_done` aliases. Every event carries `round`; `run_id` is the id of the
call it reports, except on relay events where it is the **relay run's** id and
the individual call is `entry_run_id`.

Session ids are server-generated 32-hex, validated against `^[0-9a-f]{8,64}$`
before any file access; no path is built from anything else a client sends. A
stage request returns 409 while another stage runs in that session.

## Security posture

- Binds loopback only; `Host` allow-list; 1 MB body cap; a `default-src 'none'`
  CSP permitting only inline style/script and same-origin `connect-src`.
- **Cross-site guard (council finding, 2026-09-02).** `Host` is always the
  target's, so it never proves the caller is this page. Every request is
  checked against an `Origin` / `Sec-Fetch-Site` allow-list; every POST must be
  `application/json` and carry `X-Roundtable: <token>`, a per-process
  capability token generated at startup and injected into the served page (a
  custom header forces a CORS preflight this server never answers). Before the
  fix a hostile tab could POST text/plain JSON to `/api/ask` and spend model
  minutes; the battery covers all four probes.
- **Append-only record.** Re-running disagreements or review moves the previous
  result into `disagreements_history` / `review_history`, a rerun moves the
  previous answer into `reruns`, and the export prints superseded runs under
  their own heading. Filenames carry an id suffix, so two same-second identical
  questions never collide.
- Duplicate reviewer names are deduped; captured output is capped at 2 MB per
  call; every packet that embeds another model's text says that quoted material
  is data, not instructions.
- **Model output is untrusted.** The v1 page HTML-escapes it *before* its
  hand-rolled markdown renderer runs and renders links as text plus the target
  in parentheses, never as an anchor. Any `--ui` variant owes the same.
- `--fake` never invokes a CLI, writes into the vault, or touches the real live
  logs. Cancel kills the process group of every live child in the session — or
  only the named seat's, when `seat` is given.
- `format: json` exports to `<stem>.export.json`, never the session's own
  `<stem>.json`: an export can never truncate the live record. Both exports
  read back what they wrote before returning.

## Known limits

- One SSE subscriber per tab is assumed; on reconnect the client refetches
  `/api/session/<id>` rather than replaying missed events.
- `glm-do` prints no header, so that seat's provenance is the wrapper's fixed
  tier plus the live log, not a served-model string.
- A persona step advances `step_index` even if it errors — the sequence is a
  record, not a retry loop; re-run one with `/api/relay` yourself.
- The disagreements reader uses the member's own frozen `timeout_s` even when
  `reader_tier` differs from that member's tier.
- Sessions under `.claude/roundtable/sessions/` are **not** covered by a
  `.gitignore` rule (only `.claude/dashboard/` and some `.claude/scripts/*`
  runtime patterns are); they are excluded from the read-only mirror by the
  `.claude/` deny. Decide deliberately whether a session file is committed.
