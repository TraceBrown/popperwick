# Roundtable v2 — round-five builder spec (Astra's thirteen, all conductor-confirmed at the cited lines)

Base: `variants/B/index.html` @ sha256 `a2f326b83813dbf9…`, 3,255 lines (round four). Line numbers below are in THAT file.
Same rules as ROUND4-SPEC.md: one file, API frozen, keep `const API_TOKEN = "__ROUNDTABLE_TOKEN__";`, design law, never
touch 8787/8788, own fake server on a free port, no git, no vault writes — work on a byte copy in scratch; the conductor
integrates after a diff review. All existing suites stay green at 59/25/25/13/121; add `round5.js` with one check per id,
and this time every check is a TRANSITION (type → re-enabled, open → visible, switch → preserved), not a state snapshot.

## A. Regressions from round four (fix first)
- R1 **Disagreements packet unreachable** (1545 creates the disclosure; 343 hides every `.pk > details > summary`; only
  `messageActions` wires `togglePacket`, 1351). Give the disagreements card its own single "Reveal packet" control (same
  `togglePacket`), and audit every other `packetDisclosure` caller for the same orphaning. Check: open the packet from the
  disagreements card via its control; assert the packet text is visible; assert exactly one reveal control per packet.
- R2 **Form readiness not recomputed on input.** Relay: 1820 sets `draft.prompt` only; 1829 computes `run.disabled` at render.
  Persona: 2109 sets `d.charters[role]` only; 2296 computes `create.disabled` at render. Recompute the control's disabled
  state (and the blocker text) on every `input`, without rebuilding the field the user is typing in (no caret loss — use
  `withFocus` or targeted updates). Audit all 13 `input` handlers for the same pattern. Checks: type a relay prompt with
  two seats picked → Run relay enabled; fill the third charter → Create enabled and the blocker gone; caret position
  preserved across the update.

## B. Law
- L1 **Checkbox accent** (1770, 2252; no `accent-color` in the file): `accent-color` on a neutral ink token in both themes.
- L2 **System feedback off the status hues**: `.flash.ok` (383) and `.hint.bad` (184, 2288) reuse call-status tokens. Give
  clipboard/saved/default-set flashes neutral chrome (surface-3 + text); keep `err` for failed requests only if it is a call
  outcome — validation hints get ink + weight, not `--st-error`.
- L3 **Focus visible on the recipient input** (422 `outline: none`): a `:focus-visible` ring on the input, or a ring on
  `.picker:focus-within`, whichever keeps the chip row calm.
- L4 **Message-action buttons get `data-k`** (1327) so `withFocus` (878) restores focus after a rebuild. Check: focus
  "Reply" on a message, fire a seat event that rebuilds the transcript, assert focus is still on that button.
- L5 **Roster status truth** (2456 ← `lastResultFor` 2629 reads `stage1` only): the fallback must take the seat's LAST
  result across stage1 / review / relay / persona steps, chronologically (`stampOf` exists). Check: a session whose relay
  child for a seat errored after a done stage1 shows error in the roster.
- L6 **"the reviewer saw letters only" only when true** (1638): branch on `protocol.anonymize.review` (1590 already does).

## C. Correctness
- C1 **Notes flush on navigation** (2957 debounce 900 ms; 3007 `forgetFields`): before `selectSession` clears anything,
  flush a pending notes save for the OLD sid (send it, no UI repaint); same for a pending decision draft. Check: type
  notes, switch within 900 ms, refetch the old session → notes present.
- C2 **Relay completion re-guards** (2891 no guard after `await refetch`; 2921 clears the shared composer): re-check
  `(sid, gen)` after the refetch; the caller clears the composer only if still on the same session AND the composer's
  text is still the relay draft it sent. Check: switch during the final GET, type into the composer, assert it survives.
- C3 **Same-session response ordering** (3019): a per-session monotonic fetch sequence; a response older than the last
  applied one is dropped. Check: two overlapping refetches resolved in reverse order → the newer snapshot stays.
- C4 **Create lock** (2797; `createbtn` 2295 never consults `busy()`): an in-flight create disables both Create controls
  and short-circuits a second call; Enter twice sends once. Check: double-invoke → one POST, one session.

## D. Taste (Astra §5, adopt the cheap parts)
- T1 Idle composer compressed: creed printed once, delivery explanation as a title/hint not a permanent row; Context stays
  expandable. Target: composer ≤ 200 px tall at 380×800 when idle (was 281).
- T2 Actionable metadata ≥ 13 px and one step darker than decorative metadata, both themes; sidebar row actions readable
  without hover.
- T3 Round boundaries get more vertical space than message boundaries.

Report format as ROUND4-SPEC.md. Deviations stated, never silent.
