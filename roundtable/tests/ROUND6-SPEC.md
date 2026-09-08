# Roundtable v2 — round-six seed (items found after round five; not yet commissioned)

Base: `variants/B/index.html` @ sha256 `84e51e6f4ecb1a06…`, 3,786 lines (Astra aesthetic pass, integrated 2026-09-05).

- ~~X1~~ **DONE 2026-09-05 (Astra reading pass, conductor-measured: pre blocks 360 px client / 436 px scroll, `overflow-x: auto`, `tabindex=0`; body 380).** Was: **Wide fenced code clips instead of scrolling.** Measured in real Chromium at 380×800 (conductor, 2026-09-04): the body
  never scrolls horizontally (`scrollWidth` 380 = `innerWidth`, `overflow-x: clip` on html and body), but a `<code>` line inside a
  fenced block reaches x=435 and is clipped by the root rule. The brief's law names wide TABLES as needing their own
  `overflow-x: auto` container; fenced code is the same class of wide evidence and must scroll in its own box, never be cut.
  Fix: `.prose pre { overflow-x: auto; max-width: 100% }` (and the same for any `<table>` wrapper that lacks it). Check: at
  380 px a fenced line wider than the viewport is fully reachable by scrolling the block; the body still does not scroll.
  Pre-existing (identical in round-four bytes, per the builder's baseline screenshot); not a regression.
- X2 (from Astra's G4 caveat) generic knob rendering handles enum / int / text only; a future knob of another type (bool, list)
  renders nothing. Add a typed fallback that at least shows the knob name, its raw value and range, editable as text.
