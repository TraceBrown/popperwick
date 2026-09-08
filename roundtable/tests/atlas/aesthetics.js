/* Aesthetic pass: real page renderers, synthetic seat lifecycle fixtures.
   The server still owns only its configured seats: Claude is added to the
   in-memory display fixture AFTER an empty session is created. No model call
   is needed to test identity, pending state, or the independent elapsed clock.
   CSS assertions cannot prove motion in this stub; browser QA covers that. */
"use strict";
const H = require("./harness.js");

let pass = 0, fail = 0;
function ok(label, condition, detail) {
  console.log((condition ? "PASS  " : "FAIL  ") + label + (detail ? "  [" + detail + "]" : ""));
  condition ? pass++ : fail++;
}
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = new RegExp("(?:^|\\n)\\s*" + escaped + "\\s*\\{([^}]*)\\}").exec(css);
  return found ? found[1] : "";
}
function blockAt(css, marker) {
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 1, end = open + 1;
  for (; end < css.length && depth; end++) {
    if (css[end] === "{") depth++;
    if (css[end] === "}") depth--;
  }
  return css.slice(open + 1, end - 1);
}
function attr(node, name) { return node && node.getAttribute(name); }
const markSignatures = new Map();
function validTile(tile, seat) {
  const svg = tile && tile.querySelector("svg");
  const geometry = svg && svg.querySelector("path, circle");
  const signature = tile && tile.innerHTML;
  const same = !markSignatures.has(seat) || markSignatures.get(seat) === signature;
  if (same && signature) markSignatures.set(seat, signature);
  return !!(tile && svg && geometry && same && tile.dataset.seat === seat &&
    (attr(tile, "aria-hidden") === "true" || attr(svg, "aria-hidden") === "true") &&
    attr(svg, "focusable") === "false" && !svg.querySelector("text") &&
    !svg.querySelector("image") && !svg.querySelector("use"));
}
function decorativeDials(root) {
  const dials = root ? root.querySelectorAll(".waiting-dial") : [];
  return dials.length > 0 && dials.every(dial => attr(dial, "aria-hidden") === "true" &&
    dial.tagName === "SPAN" && dial.children.length === 0 && dial.textContent === "");
}
function stopRefetch(RT) {
  if (RT.state.refetchTimer) clearTimeout(RT.state.refetchTimer);
  RT.state.refetchTimer = 0;
}

(async () => {
  const served = await H.loadServedPage();
  const css = /<style>([\s\S]*?)<\/style>/.exec(served.html)[1];
  const token = /const API_TOKEN = "([^"]+)";/.exec(served.html)[1];
  const ctx = H.makeContext(served.html, () => {});
  const W = ctx.sandbox, RT = W.RT, doc = ctx.doc;
  W.matchMedia = query => ({ media: query, matches: /prefers-reduced-motion:\s*reduce/.test(query),
    addEventListener() {}, removeEventListener() {} });
  await RT.boot();
  await H.waitFor(() => RT.state.config, "config");
  RT.act.newSessionView();
  const sid = await RT.act.createSession("");
  await H.waitFor(() => RT.state.session && RT.state.session.id === sid, "empty fixture session");
  ctx.streams.forEach(stream => stream.close());
  stopRefetch(RT);

  const stream = doc.getElementById("stream"), info = doc.getElementById("info");
  const strip = doc.getElementById("readingStatus");
  const fixture = RT.state.session;
  RT.state.config.seats.claude = Object.assign({}, RT.state.config.seats.gpt, { label: "Claude" });
  fixture.members.claude = JSON.parse(JSON.stringify(fixture.members.gpt));
  /* Boot already built next-session settings from the three-seat config.
     Rebuild that fixture draft after extending the display allow-list. */
  RT.state.next = null;
  const identities = ["gpt", "kimi", "claude", "glm", "you"];
  const seats = ["gpt", "kimi", "claude", "glm"];
  const stamp = new Date().toISOString();
  const rnd = { index: 0, asked_at: stamp, question: "@gpt @kimi @claude @glm Compare this evidence. @unknown stays text.",
    context: "A display-only fixture", stage1: {}, relays: [] };
  seats.forEach((seat, i) => { rnd.stage1[seat] = { run_id: "a00000000000000" + i, status: "done", tier: fixture.members[seat].tier,
    started_at: stamp, elapsed_s: 2, text: "A complete answer from " + seat + ".", header: "", packet: "Evidence remains inline." }; });
  fixture.rounds = [rnd];

  /* Each place a reader encounters a seat uses the same identity. */
  RT.act.newSessionView();
  ok("A1 recipient picker has four distinct decorative geometric seat marks", seats.every(seat =>
    validTile(stream.querySelector('.picker .mono-tile[data-seat="' + seat + '"]'), seat)) &&
    new Set(seats.map(seat => markSignatures.get(seat))).size === seats.length);
  ok("A2 configuration member headers reuse the same geometric marks", seats.every(seat =>
    validTile(stream.querySelector('.memberbox .mono-tile[data-seat="' + seat + '"]'), seat)));
  RT.state.session = fixture; RT.state.sid = sid; RT.state.view = "session";
  RT.render.stream(); RT.render.info(); RT.act.setComposer("@gpt @kimi @claude @glm A draft for these seats.");
  identities.forEach(seat => {
    const tile = stream.querySelector('.mhead .mono-tile[data-seat="' + seat + '"]');
    ok("A3-" + seat + " transcript author reuses its decorative geometric mark", validTile(tile, seat));
  });
  ok("A4 adjacent transcript labels still name every speaker", identities.every(seat => {
    const tile = stream.querySelector('.mhead .mono-tile[data-seat="' + seat + '"]');
    const label = seat === "you" ? "You" : RT.state.config.seats[seat].label;
    return tile && tile.parentNode.querySelector(".who").textContent.includes(label);
  }));
  ok("A5 compact strip and Info roster share each model's SVG identity", seats.every(seat =>
    validTile(strip.querySelector('.mono-tile[data-seat="' + seat + '"]'), seat) &&
    validTile(info.querySelector('.rosterrow .mono-tile[data-seat="' + seat + '"]'), seat)));
  ok("A6 known transcript mentions include their SVG identities", seats.every(seat =>
    validTile(stream.querySelector('.mention .mono-tile[data-seat="' + seat + '"]'), seat)));
  ok("A7 composer address chips include their SVG identities", seats.every(seat =>
    validTile(doc.getElementById("mentionRow").querySelector('.mono-tile[data-seat="' + seat + '"]'), seat)));
  ok("A8 unknown mentions stay plain text instead of impersonating You",
    stream.textContent.includes("@unknown") && !stream.querySelector('.mention .mono-tile[data-seat="unknown"]'));
  ok("A9 this visual pass keeps Info closed by default", doc.getElementById("app").dataset.info === "off");
  RT.state.config.seats.future = Object.assign({}, RT.state.config.seats.gpt, { label: "Future seat" });
  fixture.members.future = Object.assign({}, fixture.members.gpt);
  rnd.stage1.future = Object.assign({}, rnd.stage1.gpt, { run_id: "future-display-only" });
  RT.render.stream();
  const futureTile = stream.querySelector('.mhead .mono-tile[data-seat="future"]');
  ok("A10 an unpictured configured seat uses a neutral mark distinct from You",
    validTile(futureTile, "future") && futureTile.classList.contains("tile-neutral") &&
    futureTile.innerHTML !== markSignatures.get("you"));
  delete RT.state.config.seats.future; delete fixture.members.future; delete rnd.stage1.future;
  RT.render.stream();

  const messageFor = seat => {
    const tile = stream.querySelector('.mhead .mono-tile[data-seat="' + seat + '"]');
    return tile && tile.closest(".msg");
  };
  const stripFor = seat => {
    const tile = strip.querySelector('.mono-tile[data-seat="' + seat + '"]');
    return tile && tile.closest(".seat-status");
  };
  const statuses = { done: "Done", error: "Error", timed_out: "Timed out", cancelled: "Cancelled" };
  const OriginalDate = W.Date;
  let clock = Date.now();
  W.Date = class extends OriginalDate { static now() { return clock; } };
  let i = 0;
  for (const terminal of Object.keys(statuses)) {
    RT.state.live.clear(); delete rnd.stage1.gpt;
    RT.act.markPending(0, "stage1", ["gpt"]);
    RT.render.stream(); RT.render.info();
    let message = messageFor("gpt"), row = stripFor("gpt");
    ok("P1-" + terminal + " queued header, body and compact strip show decorative open dials",
      decorativeDials(message) && decorativeDials(row) && message.querySelectorAll(".waiting-dial").length === 2 &&
      message.querySelectorAll(".pending-state .waiting-dial").length === 1 && row.querySelectorAll(".waiting-dial").length === 1 &&
      message.querySelector(".p-queued").textContent.startsWith("Queued") && row.querySelector(".p-queued").textContent.startsWith("Queued"));
    const run = "b00000000000000" + i++;
    RT.act.handleEvent({ type: "seat_started", round: 0, stage: "stage1", seat: "gpt", run_id: run, tier: fixture.members.gpt.tier }, sid, RT.state.gen);
    const live = RT.state.live.get(run);
    live.startMs = clock - 5000;
    RT.render.stream(); RT.render.info();
    message = messageFor("gpt"); row = stripFor("gpt");
    ok("P2-" + terminal + " started call keeps dials and changes truthful state to Working",
      decorativeDials(message) && decorativeDials(row) && !!message.querySelector(".p-working") && !!row.querySelector(".p-working") &&
      !message.querySelector(".p-queued") && !row.querySelector(".p-queued") && !/typing/i.test(message.textContent));
    if (terminal === "done") {
      const timers = [message.querySelector("[data-timer]"), row.querySelector("[data-timer]")];
      const before = timers.map(timer => timer && timer.textContent);
      clock += 2000;
      await H.waitFor(() => timers.every(timer => timer && timer.textContent === "00:07"), "elapsed ticker with reduced motion", 3000);
      ok("P3 reduced-motion preference does not stop either elapsed timer",
        W.matchMedia("(prefers-reduced-motion: reduce)").matches && before.every(value => value === "00:05") &&
        timers.every(timer => timer.textContent === "00:07"));
    }
    rnd.stage1.gpt = { run_id: run, status: terminal, tier: fixture.members.gpt.tier, started_at: stamp,
      elapsed_s: 7, text: "Terminal fixture evidence: " + terminal, header: "", packet: "The retained packet." };
    RT.act.handleEvent({ type: "seat_done", run_id: run, status: terminal }, sid, RT.state.gen);
    stopRefetch(RT); RT.util.pruneLive(); RT.render.stream(); RT.render.info();
    message = messageFor("gpt"); row = stripFor("gpt");
    ok("P4-" + terminal + " terminal answer and compact strip remove every pending indicator",
      message && row && !message.querySelector(".waiting-dial") && !message.querySelector(".pending-state") && !row.querySelector(".waiting-dial") &&
      !!message.querySelector(".p-" + terminal) && !!row.querySelector(".p-" + terminal) &&
      message.textContent.includes(statuses[terminal]) && row.textContent.includes(statuses[terminal]) && message.textContent.includes("Terminal fixture evidence"));
  }
  W.Date = OriginalDate;

  /* Declaration checks complement (not replace) normal/reduced browser QA. */
  const dialRule = ruleOf(css, ".waiting-dial");
  const animation = /animation:\s*([\w-]+)[^;]*\binfinite\b/.exec(dialRule);
  ok("C1-css normal pending dials have a visible open border and continuous motion",
    !!animation && /border:\s*[\d.]+px solid currentColor/.test(dialRule) &&
    /border-right-color:\s*transparent/.test(dialRule) && /border-radius:\s*50%/.test(dialRule));
  const frames = animation ? blockAt(css, "@keyframes " + animation[1]) : "";
  ok("C2-css pending keyframes rotate the open dial", /transform:\s*rotate\(360deg\)/.test(frames));
  const reduced = blockAt(css, "@media (prefers-reduced-motion: reduce)");
  const reducedDial = ruleOf(reduced, ".waiting-dial");
  ok("C3-css reduced motion explicitly stops dials without hiding unfinished state",
    /animation:\s*none(?:\s*!important)?\s*;/.test(reducedDial) &&
    !/(?:display:\s*none|visibility:\s*hidden|opacity:\s*0(?:[;\s]|$))/.test(reducedDial));
  ok("C4-css no blanket transition or external asset request was introduced",
    !/transition:\s*all\b/.test(css) && !/@import|url\s*\(/i.test(css) &&
    !/<(?:script|img|iframe)\b[^>]*\bsrc\s*=/i.test(served.html) && !/<link\b/i.test(served.html) &&
    !/https?:\/\/(?!127\.0\.0\.1)/.test(served.html.replace(/https?:\/\/(?:www\.)?w3\.org[^"']*/g, "")));
  ok("C5 every observed page request stays on its authenticated local API",
    ctx.calls.length > 0 && ctx.calls.every(call => /^\/api\//.test(call.url) && call.headers["X-Roundtable"] === token) &&
    ctx.streams.every(source => /^\/api\//.test(source.path)));
  ok("C6 the unchanged API token placeholder remains on disk",
    H.readUI().includes('const API_TOKEN = "__ROUNDTABLE_TOKEN__";'));
  const hexToken = (block, name) => (new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})").exec(block) || [])[1];
  const luminance = hex => {
    if (!hex) return NaN;
    const rgb = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
      .map(v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const contrast = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  };
  const themes = [":root {", "@media (prefers-color-scheme: dark)", ':root[data-theme="light"]', ':root[data-theme="dark"]'];
  ok("C7-css geometric identities stay separate from accent and contrast against their paper in every theme",
    identities.every(seat => ruleOf(css, ".tile-" + seat).includes("color: var(--id-" + seat + ")")) &&
    themes.every(header => {
      const block = blockAt(css, header);
      return identities.every(seat => hexToken(block, "id-" + seat) !== hexToken(block, "accent") &&
        contrast(hexToken(block, "id-" + seat), hexToken(block, "surface")) >= 3);
    }));
  ok("C8-css expanded Context has no inner border inside the composer shell",
    /border:\s*0\b/.test(ruleOf(css, "#ctx")));

  ctx.streams.forEach(source => source.close()); stopRefetch(RT);
  if (RT.state.tickTimer) clearInterval(RT.state.tickTimer);
  console.log("RESULT: " + (fail ? "FAIL" : "PASS") + "  (" + pass + " passed, " + fail + " failed)");
  process.exit(fail ? 1 : 0);
})().catch(error => { console.log("FAIL  suite crashed: " + error.stack); process.exit(1); });
