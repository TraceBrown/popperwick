# Roundtable page suites (variant B lineage)

Headless gauntlet for `.claude/roundtable/variants/B/index.html`. `harness.js` + `dom.js` load
the SERVED page into a vm sandbox with a fake DOM and expose `window.RT`; each suite drives the
page's own code paths against a fake server and cross-checks with direct API reads.

Run (from this directory), against your own fake server on a free port:

```
ROUNDTABLE_FAKE_DELAY=0.3 python3 ../../scripts/roundtable.py --port 8802 --fake \
  --ui ../variants/B/index.html --sessions-dir /tmp/rt-verify-sessions &
for s in drive fields graft layout round4 round5 reading aesthetics; do RT_BASE=http://127.0.0.1:8802 node $s.js | grep ^RESULT; done
```

Expected (2026-09-05, Astra aesthetic pass integrated): drive 58–59 (59 only when a second session already exists) / fields 25 /
graft 25 / layout 13 / round4 121 / round5 78 / reading 27 / aesthetics 35, all 0 failed. `round4.js` C1b/G2e/G2f were amended in the
aesthetic pass (pending dots must clear on settle; the PALETTE list carries display-only claude/you; mention matching reads the label,
not the decorative SVG). `layout.js` L10/L12/L13 were amended in the
reading pass: Info now starts CLOSED at desktop (a saved choice still wins); revert = the `info` default in `boot()` plus those three
labels. `round5.js` checks are TRANSITIONS (type → re-enabled, open →
visible, switch → preserved) and were mutation-tested: removing one `syncRelayReady()` call fails R2b/R2c/R2l. `ROUNDTABLE_FAKE_DELAY=0.3` is load-bearing: 0 races the cancel check,
the default is too slow for drive's timeouts. `round4.js` carries one check per punch-list id in
`ROUND4-SPEC.md` (L1–L2, C1–C7, P1–P7, G1–G9, M1–M3); `round5.js` per `ROUND5-SPEC.md` (R1–R2, L1–L6, C1–C4, T1–T3); `reading.js` (Astra's 2026-09-05 pass: draft ownership across
sessions, pending-request gates, reading-position bookmark, review disclosure focus, wide-code keyboard reach).
`aesthetics.js` (Astra's 2026-09-05 aesthetic pass: SVG letter tiles in every identity context, pending dots across the four terminal
states, the elapsed timer under reduced motion, CSS declaration checks, network boundary).
Fake mode stores sessions under `ROUNDTABLE_FAKE_DIR`; `--sessions-dir` applies only to live mode, and `--ui` must be absolute. Never point these at 8787/8788 if review
servers are up there.

## Variant C — Decision atlas (added 2026-09-07, user: "still add it as a variant c")

`variants/C/index.html` is Astra's "Decision atlas" redesign (sandbox branch `imagined`, commit `0ff25a3`; review in
`Journal/Roundtable — Imagined Pass Review (2026-09-07).md`). It keeps every behaviour and changes the identity, so the
three suites that encode B's look (round4, round5, aesthetics) have atlas versions under `tests/atlas/`, plus the new
`imagined.js` (16 checks) and a harness whose disk-token check defaults to `variants/C/index.html`. The five
behaviour-only suites (drive, fields, graft, layout, reading) are shared and run unchanged against either page
(one branch: `fields.js` F24 checks the reply chip on a page that has one — `RT.act.setQuote` + `#quoteRow`, C since
2026-09-07 — and the old paste-path letter on a page that does not).

```
# serve C in fake mode (port 8789 is C's; 8787 A, 8788 B — never reuse)
cd ~/Claude && ROUNDTABLE_FAKE_DELAY=0.3 python3 .claude/scripts/roundtable.py --port 8789 --fake --ui "$PWD/.claude/roundtable/variants/C/index.html" &
cd .claude/roundtable/tests
for s in drive fields graft layout reading; do RT_BASE=http://127.0.0.1:8789 node $s.js | grep ^RESULT; done
for s in round4 round5 aesthetics imagined grid; do RT_BASE=http://127.0.0.1:8789 node atlas/$s.js | grep ^RESULT; done
```
Expected: drive 59 · fields 31 · graft 25 · layout 13 · reading 27 · round4 163 · round5 78 · aesthetics 35 · imagined 16 · grid 16 — 463, 0 failed (drive is 58 on a fresh fake sessions dir, 59 once a second session exists).
(round4 was 121 before the reply chip, 2026-09-07: G5d rewritten to the chip's record, Q1–Q13 added — quote staging, ×/Escape,
send composition, failed-send retention, view parking, the question and relay caps met before the send, Edit-as-text,
empty answers, the exact "> " shape, one-Escape-one-change, the persona hold.)

## Variant D — Chamber (conductor's own, 2026-09-07; user: "I would like to see you try with creativity now")

`variants/D/index.html` (sha `d1f08233ba6a295f…`) is the conductor's re-skin of the atlas DOM: same markup and script as C, a
new stylesheet. Cool porcelain/slate canvas, ink chrome (the accent is the ink itself, so colour only ever means a
person or an outcome), answers as floating cards with a hairline, radius and soft shadow, ring seat marks, pill
controls, a display-sans question headline, an ink-bordered decision record. Because the atlas suites encode the
atlas's edge-to-edge identity, six checks are rewritten for a card identity under `tests/chamber/`
(P1a, P1b, P1d, P7b, P7c in round4; T3a in round5 — each carries a dated comment); everything else is the atlas
suite unchanged, and the five behaviour suites are shared. Design note:
`Journal/Roundtable — Chamber (2026-09-07).md`.

```
# serve D in fake mode (port 8790 is D's; 8787 A, 8788 B, 8789 C)
cd ~/Claude && ROUNDTABLE_FAKE_DELAY=0.3 python3 .claude/scripts/roundtable.py --port 8790 --fake --ui "$PWD/.claude/roundtable/variants/D/index.html" &
cd .claude/roundtable/tests
for s in drive fields graft layout reading; do RT_BASE=http://127.0.0.1:8790 node $s.js | grep ^RESULT; done
for s in round4 round5 aesthetics imagined; do RT_BASE=http://127.0.0.1:8790 node chamber/$s.js | grep ^RESULT; done
```
Expected: the same 399 checks, 0 failed.

## 2026-09-08 — four changes landed on C and the server (fleet-built, skeptic-reviewed, conductor-integrated)

Server: GPT effort enum gains `max`; GPT tiers `terra` (probation control) and `astra` (review/design tier) after `sol`; `MAX_SEATS = 4` with a 400 past four members and `max_seats` in the config (fields F26–F30). Page (C): compare grid auto-fit 1/2/3 across and 2x2 at four (`compareCols`, `tests/atlas/grid.js`, 16 checks); Quote is a reply chip above the composer — one line, glyph, Edit and ×, the whole answer attached as "> " lines on send, the caps met before the send (round4 G5d rewritten, Q1–Q13 added; fields F24 rewritten with a branch for pages without the chip). Record: `Journal/Roundtable — Feature Round One (2026-09-08).md`.
