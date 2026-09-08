# Roundtable v2 — round-four builder pass (B base, A's transcript presentation, full punch list)

## What you are building
One HTML file: `SCRATCH/rt-round4/index.html`. It starts as a byte copy of variant B
(sha256 d568fae11f2841c5…, 2,935 lines). You edit THAT copy in place. You never edit
`.claude/roundtable/variants/A/index.html`, `.claude/roundtable/variants/B/index.html`, or
`.claude/scripts/roundtable.py` — read them, do not write them. The conductor diffs your file
against the baseline and integrates it; nothing you write lands in the vault by itself.

Paths (SCRATCH = /private/tmp/claude-501/-Users-OWNER-Claude/2cddb77f-0bce-4727-bceb-664c06b73132/scratchpad):
- Your file: `SCRATCH/rt-round4/index.html`
- Baseline B (read-only reference): `SCRATCH/rt-baseline/B-2935.html`
- Variant A (read-only; the source of every graft below): `SCRATCH/rt-baseline/A-2282.html`
- Server (read-only; API contract is FROZEN, do not change it): `SCRATCH/rt-baseline/roundtable-2062.py`
  (identical to `/Users/OWNER/Claude/.claude/scripts/roundtable.py`)
- Brief (the law): `/Users/Shared/roundtable-review/brief.md` — read "Rules that are law" and "API contract" first.
- Existing suites (B's, all green at baseline): `SCRATCH/rt-suites/laneB/{harness,drive,fields,graft,layout}.js`
  Run them with `RT_BASE=http://127.0.0.1:8802 node drive.js` etc. from that directory.
  Expected at baseline: drive 58/0, fields 25/0, graft 25/0, layout 13/0. They must stay green.

## Your own fake server (never touch 8787/8788 — those are detached review servers, leave them alone)
```
python3 .claude/scripts/roundtable.py --port 8802 --fake --ui SCRATCH/rt-round4/index.html &
```
`ROUNDTABLE_FAKE_DELAY=2` (seconds) slows fake seats when you need a Working state to test against.
Kill YOUR server (by pid) when you finish. Port 8802 is free right now.

## Hard rules (a violation fails the pass)
1. ONE self-contained file. No external requests of any kind (no CDN, webfont, image, @import). Same-origin fetch + EventSource only.
2. Keep the exact line `const API_TOKEN = "__ROUNDTABLE_TOKEN__";` — the server substitutes it. Every POST sends `X-Roundtable` + `Content-Type: application/json`; GETs send the header.
3. Do not change the server or the API. If a fix seems to need a server change, do the client-side part, and report the gap.
4. Design law (brief + vault-design-craft): status colours are their own channel, never the accent, never chrome; a failed/cancelled seat looks FAILED at a glance; evidence scrolls, never hides; no `transition: all`, no gradients, no side-stripe cards, no emoji, no bordered box inside a bordered box of the same surface; `overflow-x: clip` on html/body; `tabular-nums` on every timer/count/matrix; reduced-motion respected; visible `:focus-visible`; dual theme with `data-theme` overrides winning both directions.
5. Keep B's engineering intact: `(sid, gen)` guards, live-field cache (`liveField`/`syncField`/`fieldSaved`/`forgetFields`), placeholder reconciliation, `STATUS_RANK`, reviewer picker, composer feedback, `window.RT` test hook, 74-ch / 15.5px / 1.62 prose measure.
6. Every punch item below gets a check in a NEW suite `SCRATCH/rt-suites/laneB/round4.js` (same harness, same PASS/FAIL format). Where a check needs a real layout engine (mobile drawers, 380 px clipping), do it in headless Chrome instead and record the command + result:
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --window-size=380,800 --screenshot=SCRATCH/rt-round4/shot-380.png http://127.0.0.1:8802/?session=<id>`
   (classic `--headless`; `--headless=new` produced 0-byte files here). Poll for the file.
7. No git. No edits outside `SCRATCH/rt-round4/` and `SCRATCH/rt-suites/laneB/round4.js`. No commits, no vault writes.

## The punch list — every item is required; number your report by these ids
Locators are line numbers in the BASELINE files (B-2935 / A-2282), from the reviews.

### I. Law violations
- L1 **Cancelled must look failed.** B paints cancelled in purple `--st-cancel` (B:81, 100, 111, 120, 236, 269). Move cancelled into the failure family: same hue family as error/timeout (a red/ochre status token), distinct from done, so a cancelled seat reads as a failure at a glance in both themes. The roster pill, the message border and the header all follow. Keep the status *text* "CANCELLED".
- L2 **Fake banner must not wear the working hue.** `#fakebar` (B:176–179) uses working-status tokens as a full-bleed band. Make it neutral chrome (a bordered strip in surface/ink tokens, or a small neutral chip in the header like A's but NOT in `--work`). It must still be unmistakable that no model was called.

### II. Correctness (P1/P2 from the pixel reviews, all source-confirmed)
- C1 **P1 Reconnect placeholder over a fetched result** (B:1029, B:1262). A missed completion after SSE reconnect leaves the live entry "Working" and rendering prefers the placeholder over the fetched result. Fix: on every refetch (`resync`, reconnect, or GET /api/session), any live entry whose (round, stage, seat, run_id) exists in the fetched session with a terminal status is reconciled to the fetched result and the placeholder dropped. Prove it: start a slow fake round, simulate a lost `seat_done` (e.g. drop the event via the RT hook or close and reopen the EventSource), refetch, and assert the fetched text renders, not "Working".
- C2 **P1 Create-then-send misaddress** (B:2560; the same bug is in A:1202). Creation awaits the new session then sends the opening question with whichever session is current. Fix: capture the intended session id at creation and send to THAT id; if the user moved meanwhile, send to the created session anyway and do not repaint the current one. Prove it with a check that switches sessions during the await.
- C3 **Unknown `?session=` id is silent** (B:2900–2901). Show a visible, dismissable error line naming the id ("session 0d7d20f0 did not load"), then land on the list. A's behaviour is the model, minus A's stale-flash bug (C4).
- C4 **Flash must clear.** A's flash never clears (A:598–602, 2097). B's new error line from C3 must clear on the next successful session load and on dismiss. (You are not editing A; this is a design constraint on your C3.)
- C5 **Relay draft cleared on failure** (B:2629, P2). `runRelay` empties the composer even on its caught-failure path. Only clear on success; on failure keep the draft and surface the error in the composer feedback line.
- C6 **Draft preservation on 409 / refresh** (A's bugs, A:1903 and A:2000 — make sure B does NOT share them). Verify B never clears question/context before a round request succeeds, and that the live-field cache protects EVERY unsaved field on refresh, not only the focused one. Add checks; fix if B fails them.
- C7 **`worstStatus` order.** B's `STATUS_RANK` (B:487) is already right (error > timed_out > cancelled > done). Add a check that a stage containing both a cancelled and an errored child reports error, so the graft in P4 can't regress it.

### III. Presentation: A's transcript, on B's measure
The pixel judges chose A's transcript for daily reading. Graft A's presentation onto B's engine, keeping B's 74-ch / 15.5px / 1.62 prose column:
- P1 **Unboxed messages.** Replace B's bordered message cards (`.msg`, B:~230–240 region) with A's flat treatment: no card border by default, thin separator between messages, small author label line (identity chip + tier + CLI header line + elapsed), body directly beneath. Failure states STILL get a visible treatment (a status-coloured left-edge is FORBIDDEN by law; use the status pill + a status-tinted header line + status-coloured status text, as B does today).
- P2 **Hover-gated actions.** B's six-button strip is always visible after every message (B:1145 `messageActions`). Make the strip appear on hover AND on keyboard focus-within (so it stays reachable without a mouse), collapsed otherwise. Respect reduced-motion (no animation, just visibility).
- P3 **One Reveal-packet affordance.** B shows a `<details>` disclosure (B:1099) AND an action button (B:1173). Keep ONE: the action button, opening the same disclosure. Evidence must not hide: the packet stays reachable in one click.
- P4 **Round-head aggregate chip** (graft from A:1471–1477 into B's round divider B:1562–1567): "N/M answered · X failed", failure count in the status hue when > 0.
- P5 **Decision near the top of the info pane.** Move B's human-decision block above the effective-configuration/settings sections in the info pane (Sol: "Human decision sits below a long configuration/settings section"). Order: status roster → decision → notes → effective config (+hash) → next-session settings → export.
- P6 **Relay preselection.** When "Relay…" is opened from a round, preselect the seats that answered that round (A's behaviour; B opens with none selected).
- P7 **Calmer chrome.** Fewer repeated borders and packet bars; keep B's header, sidebar and composer, but drop any bordered box nested in a bordered box of the same surface colour (law).

### IV. Feature grafts from A (the jury's list)
- G1 **Role-centric persona assignment rows** (A:1057–1083) in place of B's per-member role selects (B:1788–1798), PLUS a client-side check that bull / bear / risk occupy three DIFFERENT seats before Create (disable Create + inline message; the server 400 stays as the backstop).
- G2 **Member-driven @mention parsing** (A:1799–1814) replacing the hard-coded seat trio / `SEAT_ORDER` remnants (B:467, 2106–2114, 1140–1150). Mentions derive from the session's `members`.
- G3 **Authoritative timeout range** from `ranges.timeout_s` (A:1049–1051 → B:1753, 1845) and generic bound iteration via `Object.keys(bounds)` (A:1117–1121).
- G4 **Generic knob rendering from `/api/config`** (GLM's catch): render EVERY allow-listed knob the server exposes, by type, from the config payload — effort (enum), max_tokens (int range), timeout_s (int range), and anything future — instead of hard-coding the three (B:1753–1785). "Every option available" means a knob the server adds shows up with no page change. Keep B's range annotations and rationale copy.
- G5 **Full-length Quote / relay seeding with a visible trim notice** (A:1277–1285, 1735–1741) over B's silent 800-char / 40-line cuts. Trim at 4,000 chars and SAY so in the composer.
- G6 **Timestamp-sorted stage blocks** (A:1513–1541) where B renders by fixed stage order. B already has `stampOf` — make the chronological order the rendering order.
- G7 **Editable "Settings for the next session"** in the info pane: protocol rows (A:1936–1947 → B:1986–2022) AND member knobs, editable, feeding the New-session form. Both pages missed a complete version; build it.
- G8 **Editing guard** — confirm B's live-field cache covers the decision/rationale/dissent fields as well as notes; extend if not.
- G9 **Persona step disabled outside persona mode** — B already does this (B:2133); keep it and add a check.

### V. Mobile (380 px)
- M1 **Drawers dismissable.** Sessions drawer and info drawer each get a visible close control and dismiss on Escape; a drawer never covers its own toggle; opening one drawer closes the other; "New session" opens ABOVE any open drawer or closes it first.
- M2 **Theme control not clipped** at 380 px (Sol: header squeezes it to a clipped "System"). Reflow the header so the theme control and pane toggles are fully visible at 380 px.
- M3 Prove M1/M2 with headless-Chrome screenshots at 380×800 and 1280×900 (both themes), saved under `SCRATCH/rt-round4/`, and state what each shows.

## Verification you owe before reporting
1. All five existing suites green at the SAME counts (58/25/25/13) against your file on 8802. If a count changes, explain why.
2. `round4.js` green, one or more checks per punch id above; print the id in each check label.
3. `node --check` on every `<script>` block (extract, then check); an HTML parse (python `html.parser` is fine) reports no nesting errors.
4. The external-reference lint: `grep -nE "https?://|@import|fetch\(|XMLHttpRequest|<link|src=|srcset|url\(|new WebSocket|EventSource|sendBeacon|import\(" index.html` — every hit is same-origin fetch/EventSource or a benign constant; list the hits.
5. Both themes, both explicit `data-theme` overrides, at 380 and 1280: no horizontal body scroll; failed seat visibly failed; fake banner neutral.

## Report format (your final message is data for the conductor, not prose for a person)
- File path + `wc -l` + sha256.
- A table: punch id → what changed (line refs in YOUR file) → which check proves it (suite + label) → status DONE / PARTIAL / NOT DONE + why.
- Verbatim final lines of each suite run (the `RESULT:` lines), the lint hits, the screenshot list.
- Anything you judged the spec got wrong, with your reasoning — do not silently deviate.
- Your server's pid and confirmation it is stopped.
