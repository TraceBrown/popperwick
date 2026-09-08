/* Round-four punch list. One or more checks per punch id (L1-L2, C1-C7, P1-P7,
   G1-G9, M1-M3); the id is the first token of every label. Same harness, same
   PASS/FAIL format as drive/fields/graft/layout. */
"use strict";
const H = require("./harness.js");

let pass = 0, fail = 0;
const notes = [];
function ok(l, c, d) {
  if (c) { pass++; console.log("PASS  " + l + (d ? "  [" + d + "]" : "")); }
  else { fail++; console.log("FAIL  " + l + (d ? "  [" + d + "]" : "")); }
}
function note(s) { notes.push(s); console.log("NOTE  " + s); }
function typeInto(node, text) { node.focus(); node.value = text; node.dispatchEvent({ type: "input", target: node }); }

/* ---- colour helpers: a status token's HUE is the thing under test --------- */
function hueOf(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
function hueGap(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
function tokenIn(css, header, name, span) {
  const at = css.indexOf(header);
  if (at < 0) return null;
  const chunk = css.slice(at, at + (span || 1700));
  const m = new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})").exec(chunk);
  return m ? m[1] : null;
}
function ruleOf(css, sel) {
  const re = new RegExp("(^|\\n)" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = re.exec(css);
  return m ? m[2].trim().replace(/\s+/g, " ") : null;
}
/* H.waitFor checks pred() synchronously, so an async predicate resolves to a
   truthy Promise and the wait returns at once. Anything that has to ASK the
   server uses this instead. */
async function until(fn, label, ms) {
  const limit = ms || 25000, t0 = Date.now();
  while (Date.now() - t0 < limit) {
    let good = false;
    try { good = await fn(); } catch (e) { good = false; }
    if (good) return true;
    await H.sleep(80);
  }
  throw new Error("timed out waiting for: " + label);
}
let TOKEN = "";
async function apiGet(path) {
  const r = await fetch(H.BASE + path, { headers: { "X-Roundtable": TOKEN } });
  return await r.json();
}
async function apiPost(path, body) {
  const r = await fetch(H.BASE + path, {
    method: "POST",
    headers: { "X-Roundtable": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}

(async () => {
  const served = await H.loadServedPage();
  TOKEN = /const API_TOKEN = "([^"]+)"/.exec(served.html)[1];
  const css = /<style>([\s\S]*?)<\/style>/.exec(served.html)[1];
  const body = /<body>([\s\S]*?)<\/body>/.exec(served.html)[1];

  /* =================================================================== L1 */
  const THEMES = [
    ["light system", ":root {"],
    ["dark system", "@media (prefers-color-scheme: dark) {"],
    ["light forced", ':root[data-theme="light"] {'],
    ["dark forced", ':root[data-theme="dark"] {']
  ];
  const hues = THEMES.map(t => {
    const cancel = tokenIn(css, t[1], "st-cancel");
    const error = tokenIn(css, t[1], "st-error");
    const timeout = tokenIn(css, t[1], "st-timeout");
    const done = tokenIn(css, t[1], "st-done");
    return { name: t[0], cancel: cancel, error: error, timeout: timeout, done: done,
             hc: hueOf(cancel), he: hueOf(error), ht: hueOf(timeout), hd: hueOf(done) };
  });
  ok("L1a every theme defines a cancelled token",
     hues.every(h => h.cancel && h.error && h.done),
     hues.map(h => h.name + " " + h.cancel).join(" · "));
  ok("L1b cancelled sits in the SAME hue family as error/timeout in all four themes",
     hues.every(h => hueGap(h.hc, h.he) <= 30 || hueGap(h.hc, h.ht) <= 30),
     hues.map(h => h.name + " cancel " + Math.round(h.hc) + "° vs error " + Math.round(h.he) + "° / timeout " + Math.round(h.ht) + "°").join(" · "));
  ok("L1c cancelled is nowhere near done, in all four themes",
     hues.every(h => hueGap(h.hc, h.hd) >= 60),
     hues.map(h => h.name + " gap " + Math.round(hueGap(h.hc, h.hd)) + "°").join(" · "));
  ok("L1d the purple cancelled tokens are gone from the file",
     served.html.indexOf("#6b5a7d") < 0 && served.html.indexOf("#b39ccb") < 0);
  ok("L1e the cancelled pill is filled like the other failures, not an outline",
     /\.p-cancelled \{[^}]*background: var\(--st-cancel\)/.test(css) &&
     /\.p-error \{[^}]*background: var\(--st-error\)/.test(css),
     ruleOf(css, ".p-cancelled"));
  ok("L1f cancelled margin authors and message surfaces follow the failure hue",
     /color: var\(--st-cancel\)/.test(ruleOf(css, ".msg.cancelled .mhead")) &&
     /background: var\(--tint-cancel\)/.test(ruleOf(css, ".msg.cancelled")),
     ruleOf(css, ".msg.cancelled .mhead"));
  ok("L1g the status word is still CANCELLED, not renamed to a failure",
     /cancelled: "Cancelled"/.test(served.html));

  /* =================================================================== L2 */
  const fake = ruleOf(css, "#fakebar");
  ok("L2a the fake banner wears no status token at all",
     fake.indexOf("--st-") < 0 && fake.indexOf("--tint-") < 0, fake);
  ok("L2b the fake banner is surface + ink chrome with its own border",
     /background: var\(--surface-3\)/.test(fake) && /color: var\(--text\)/.test(fake) &&
     /border-bottom: 1px solid var\(--border-2\)/.test(fake));
  ok("L2c it is still unmistakable that no model was called",
     body.indexOf("FAKE SEATS — no model was called") > 0 &&
     /text-transform: uppercase/.test(fake) && /font-weight: 650/.test(fake));

  /* =============================================== boot a driven context === */
  const ctx = H.makeContext(served.html, () => {});
  const doc = ctx.doc, RT = ctx.sandbox.RT;
  await RT.boot();
  await H.waitFor(() => RT.state.config, "config");
  const stream = doc.getElementById("stream");
  const info = doc.getElementById("info");
  const flashText = () => doc.getElementById("flash").textContent.replace("Dismiss", "").trim();

  RT.act.newSessionView();
  RT.act.setComposer("Which cost dominates a one-person research desk in year one?");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.sid, "session id");
  const sidA = RT.state.sid;
  await H.waitFor(() => Object.keys((((RT.state.session || {}).rounds || [])[0] || {}).stage1 || {}).length === 3, "three answers");
  await H.waitFor(() => stream.querySelectorAll(".p-done").length === 3, "three done pills");

  /* =================================================================== C1
     A completion this page never saw. The record holds the run as terminal;
     the live entry still says "working" because seat_done was lost. */
  const rec = RT.state.session.rounds[0].stage1.gpt;
  const plainLine = String(rec.text || "").split("\n")
    .filter(l => l.trim() && !/^[#>\-*`]/.test(l.trim()))[0] || "";
  const answerHead = plainLine.replace(/[*`_]/g, "").slice(0, 30);
  const gptMsg = () => stream.querySelectorAll(".msg")
    .filter(m => m.textContent.indexOf("run " + String(rec.run_id).slice(0, 8)) >= 0)[0];
  RT.act.handleEvent({ type: "seat_started", stage: "stage1", seat: "gpt", round: 0,
                       run_id: rec.run_id, tier: rec.tier }, sidA, RT.state.gen);
  const revived = RT.util.liveFor(0, "stage1", "gpt");
  ok("C1a the lost-completion state is real: a live entry says working while the record says done",
     !!revived && revived.settled === false && revived.status === "working" && rec.status === "done",
     "live=" + (revived && revived.status) + " record=" + rec.status);
  RT.render.stream();
  const gnode = gptMsg();
  ok("C1b the fetched result renders, not the placeholder",
     !!gnode && gnode.querySelectorAll(".p-done").length === 1 && gnode.querySelectorAll(".p-working").length === 0 &&
     gnode.querySelectorAll(".waiting-dial").length === 0 &&
     gnode.querySelectorAll(".pending-state").length === 0 &&
     gnode.textContent.indexOf(answerHead) >= 0,
     gnode ? gnode.querySelector(".pill").textContent + " · answer text present=" +
             (gnode.textContent.indexOf(answerHead) >= 0) : "no gpt message");
  await RT.act.refetch(sidA, RT.state.gen);
  ok("C1c the refetch reconciles the placeholder away",
     !RT.util.liveFor(0, "stage1", "gpt"),
     RT.state.live.size + " live entries after the refetch");
  /* negative control: a run that is genuinely still out must NOT be reconciled */
  RT.act.handleEvent({ type: "seat_started", stage: "stage1", seat: "kimi", round: 0,
                       run_id: "ffffffffffffffff", tier: "k3" }, sidA, RT.state.gen);
  await RT.act.refetch(sidA, RT.state.gen);
  ok("C1d a run that is NOT in the record survives the prune (the fix is not a blanket drop)",
     !!RT.util.liveFor(0, "stage1", "kimi"),
     "kept " + (RT.util.liveFor(0, "stage1", "kimi") || {}).status);
  RT.state.live.clear();
  await RT.act.refetch(sidA, RT.state.gen);

  /* =================================================================== C2 */
  const roundsBeforeA = RT.state.session.rounds.length;
  RT.state.draft = RT.act.defaultDraft();
  RT.act.setComposer("ROUND ADDRESSED TO THE SESSION THAT WAS JUST CREATED");
  const creating = RT.act.createSession();              /* parked at the create POST */
  await RT.act.selectSession(sidA);                     /* the reader moves, mid-await */
  const createdId = await creating;
  ok("C2a the reader's own choice is still the open session",
     RT.state.sid === sidA, "open " + String(RT.state.sid).slice(0, 8) + " created " + String(createdId).slice(0, 8));
  const createdRec = await apiGet("/api/session/" + createdId);
  ok("C2b the opening question landed on the session it was created for",
     (createdRec.rounds || []).length === 1 &&
     createdRec.rounds[0].question === "ROUND ADDRESSED TO THE SESSION THAT WAS JUST CREATED",
     (createdRec.rounds || []).length + " round(s) on " + String(createdId).slice(0, 8));
  const openRec = await apiGet("/api/session/" + sidA);
  ok("C2c the session on screen was not touched",
     (openRec.rounds || []).length === roundsBeforeA, (openRec.rounds || []).length + " rounds, was " + roundsBeforeA);
  ok("C2d the page says where the round went",
     /started on session/.test(flashText()) && flashText().indexOf(String(createdId).slice(0, 8)) >= 0,
     flashText());
  ok("C2e the transcript on screen was not repainted with the other session's round",
     stream.textContent.indexOf("ROUND ADDRESSED TO THE SESSION") < 0);

  /* =================================================================== C5 + G5
     A relay the server refuses must not eat the draft. turns=99 is refused by
     the server on `turns`, so the order and prompt are both valid. */
  RT.state.turns = 99;
  RT.act.setComposer("@gpt @glm which line dominates, and why is the other one wrong?");
  const kept = doc.getElementById("msg").value;
  const started = await RT.act.runRelayFromComposer();
  ok("C5a a refused relay is reported as not started", started === false);
  ok("C5b the composer draft survives the failure, character for character",
     doc.getElementById("msg").value === kept, JSON.stringify(doc.getElementById("msg").value.slice(0, 40)));
  ok("C5c the reason is surfaced in the composer feedback line",
     /draft is untouched/.test(doc.getElementById("deliveryNote").textContent) &&
     doc.getElementById("deliveryNote").className.indexOf("bad") >= 0,
     doc.getElementById("deliveryNote").textContent);
  ok("C5d the server's own message is on the page too",
     /turns/.test(flashText()), flashText());
  RT.state.turns = 1;
  const longTopic = "@gpt @glm " + "z".repeat(4600);
  RT.act.setComposer(longTopic);
  const ranLong = await RT.act.runRelayFromComposer();
  ok("G5a an over-cap composer relay still runs, trimmed to the server's cap",
     ranLong === true && RT.act.relayDraft(0).prompt.length === 4000,
     "prompt " + RT.act.relayDraft(0).prompt.length + " chars");
  ok("G5b the trim is SAID, not silent",
     /trimmed to 4000 of 46\d\d characters/.test(doc.getElementById("deliveryNote").textContent),
     doc.getElementById("deliveryNote").textContent);
  ok("G5c the successful relay did clear the composer",
     doc.getElementById("msg").value === "");
  ok("G5d Quote takes the whole answer — no 800-char, no 40-line cut",
     served.html.indexOf('slice(0, 40)') < 0 && served.html.indexOf("slice(0, 800)") < 0 &&
     /the whole answer: a silent cut is a lie/.test(served.html));
  await until(async () => {
    const s = await apiGet("/api/session/" + sidA);
    const r = s.rounds[0].relays || [];
    return r.length && r[r.length - 1].status !== "running";
  }, "the relay finishes", 30000);
  await RT.act.refetch(sidA, RT.state.gen);

  /* =================================================================== C6 */
  const blocker = await apiPost("/api/round", { id: sidA, question: "a stage that is still running" });
  ok("C6a a second round is accepted so a stage is genuinely in flight", blocker.status === 200, "HTTP " + blocker.status);
  RT.act.setComposer("MY UNSENT DRAFT — THE SERVER IS BUSY");
  const ctxBox = doc.getElementById("ctx");
  ctxBox.value = "CONTEXT THE READER ALSO WANTS KEPT";
  await RT.act.sendComposer();
  ok("C6b a 409 never clears the question or the context",
     doc.getElementById("msg").value === "MY UNSENT DRAFT — THE SERVER IS BUSY" &&
     ctxBox.value === "CONTEXT THE READER ALSO WANTS KEPT",
     JSON.stringify(doc.getElementById("msg").value.slice(0, 24)) + " / " + JSON.stringify(ctxBox.value.slice(0, 24)));
  ok("C6c the refusal is reported, not swallowed", /409|running|stage/i.test(flashText()), flashText());
  RT.act.setComposer(""); ctxBox.value = "";
  await until(async () => {
    const s = await apiGet("/api/session/" + sidA);
    const last = s.rounds[s.rounds.length - 1];
    return Object.keys(last.stage1 || {}).length === 3;
  }, "the blocking round settles", 30000);
  await RT.act.refetch(sidA, RT.state.gen);

  /* =============================================== C6/G8: unfocused drafts === */
  RT.render.info();
  const notesNode = doc.querySelector('[data-k="notes"]');
  typeInto(notesNode, "a note the reader has not finished");
  notesNode.blur();
  doc.activeElement = doc.body;                     /* nothing is focused now */
  const idsBefore = { notes: notesNode };
  await RT.act.refetch(sidA, RT.state.gen);
  ok("C6d an UNFOCUSED unsaved field survives a refresh, same node",
     doc.querySelector('[data-k="notes"]') === idsBefore.notes &&
     doc.querySelector('[data-k="notes"]').value === "a note the reader has not finished",
     JSON.stringify(doc.querySelector('[data-k="notes"]').value));

  /* =================================================================== C7 */
  ok("C7a worstStatus ranks error above cancelled",
     RT.util.worstStatus(["cancelled", "error"]) === "error" &&
     RT.util.worstStatus(["done", "cancelled"]) === "cancelled" &&
     RT.util.worstStatus(["cancelled", "timed_out"]) === "timed_out",
     "error>timed_out>cancelled>done");
  await RT.act.runReview(0);
  await until(async () => {
    const s = await apiGet("/api/session/" + sidA);
    return Object.keys(((s.rounds[0] || {}).review || {}).results || {}).length === 3;
  }, "reviews", 30000);
  await RT.act.refetch(sidA, RT.state.gen);
  const revSeats = Object.keys(RT.state.session.rounds[0].review.results);
  RT.state.session.rounds[0].review.results[revSeats[0]].status = "cancelled";
  RT.state.session.rounds[0].review.results[revSeats[1]].status = "error";
  RT.render.stream();
  const revThread = stream.querySelectorAll(".thread").filter(t => t.textContent.indexOf("Rank matrix") >= 0)[0];
  ok("C7b a stage holding a cancelled AND an errored child reports ERROR",
     !!revThread && revThread.querySelectorAll(".thead .p-error").length === 1 &&
     revThread.querySelectorAll(".thead .p-cancelled").length === 0,
     revThread ? revThread.querySelector(".thead .pill").textContent : "no review thread");
  ok("C7c the failed stage is not painted as success",
     !!revThread && revThread.querySelectorAll(".thead .p-done").length === 0 &&
     revThread.querySelectorAll(".card.bad").length === 1);
  RT.state.session.rounds[0].review.results[revSeats[0]].status = "done";
  RT.state.session.rounds[0].review.results[revSeats[1]].status = "done";

  /* =================================================================== P1 */
  const msgRule = ruleOf(css, ".msg");
  /* Chamber amendment (2026-09-07): a message IS a card here — hairline, fill, radius token, shadow —
     and cards are separated by a gap rather than a rule. The atlas asserted the opposite by identity. */
  ok("P1a a message is a card: hairline border, surface fill, radius token and a shadow",
     /border: 1px solid var\(--border\)/.test(msgRule) && /background: var\(--surface\)/.test(msgRule) &&
     /border-radius: var\(--rc\)/.test(msgRule) && /box-shadow: var\(--shadow\)/.test(msgRule), msgRule);
  ok("P1b messages are separated by a gap of at least 12px, and no first-child rule fights the card border",
     (() => { const mm = /margin:\s*\d+(?:px)? \d+(?:px)? (\d+)px/.exec(msgRule); return !!mm && Number(mm[1]) >= 12; })() &&
     !/\.msg:first-child \{/.test(css), msgRule);
  ok("P1c no coloured side stripe anywhere on a message",
     !/\.msg[^{]*\{[^}]*border-left:\s*[^;]*var\(--st-/.test(css) &&
     !/\.msg[^{]*\{[^}]*border-right:\s*[^;]*var\(--st-/.test(css) &&
     !/\.msg[^{]*\{[^}]*border-color: var\(--st-/.test(css));
  ok("P1d an inline author row sits above a bounded, readable prose measure (Chamber: no margin column)",
     /flex-direction: row/.test(ruleOf(css, ".msg .mhead")) &&
     /font-size: 16px; line-height: 1\.7; max-width: 68ch/.test(ruleOf(css, ".msg .prose")));
  /* a failed message still LOOKS failed with no border to carry it */
  const bad = RT.state.session.rounds[0].stage1;
  const firstSeat = Object.keys(bad)[0];
  const savedStatus = bad[firstSeat].status;
  bad[firstSeat].status = "cancelled";
  RT.render.stream();
  const cancelledCard = stream.querySelectorAll(".msg.cancelled")[0];
  ok("P1e an unboxed failed message still carries its status class, pill and word",
     !!cancelledCard && cancelledCard.querySelectorAll(".p-cancelled").length === 1 &&
     cancelledCard.textContent.indexOf("Cancelled") >= 0,
     cancelledCard ? cancelledCard.querySelector(".pill").textContent : "no cancelled message");
  ok("P1f each failure margin and full message surface carry its own outcome token",
     [["bad", "error"], ["cancelled", "cancel"], ["timeout", "timeout"]].every(([cls, token]) =>
       ruleOf(css, ".msg." + cls + " .mhead").includes("color: var(--st-" + token + ")") &&
       ruleOf(css, ".msg." + cls).includes("background: var(--tint-" + token + ")")));
  bad[firstSeat].status = savedStatus;
  RT.render.stream();

  /* =================================================================== P2 */
  const actsRule = ruleOf(css, ".acts");
  ok("P2a the action shelf is visible without discovery by hover",
     /max-height: none/.test(actsRule) && /opacity: 1/.test(actsRule) && /overflow: visible/.test(actsRule), actsRule);
  ok("P2b persistent actions retain a visible keyboard focus treatment",
     /outline: 2px solid var\(--accent\)/.test(ruleOf(css, ":focus-visible")) &&
     !/\.msg:(?:hover|focus-within)[^{]*> \.acts \{[^}]*(?:opacity: 0|display: none)/.test(css));
  ok("P2c it is NOT display:none — a display-none button cannot be tabbed to, so focus-within could never fire",
     actsRule.indexOf("display: none") < 0 && /display: flex/.test(actsRule));
  const anyActs = stream.querySelectorAll(".acts")[0];
  ok("P2d every button is still in the document (and therefore in the tab order)",
     !!anyActs && anyActs.querySelectorAll("button").length >= 5,
     anyActs ? anyActs.querySelectorAll("button").map(b => b.textContent).join(" | ") : "no strip");
  ok("P2e nothing animates, so reduced-motion needs no exception for this",
     actsRule.indexOf("transition") < 0 && actsRule.indexOf("animation") < 0);
  ok("P2f the same visible wrapping action shelf serves touch devices",
     /display: flex/.test(actsRule) && /flex-wrap: wrap/.test(actsRule) && /opacity: 1/.test(actsRule) &&
     !/@media \(hover: none\)[\s\S]*?\.acts \{[^}]*(?:opacity: 0|display: none)/.test(css));

  /* =================================================================== P3 */
  const anyMsg = stream.querySelectorAll(".msg").filter(m => m.querySelectorAll(".pk").length === 1)[0];
  const pkKey = anyMsg.querySelector(".pk details").dataset.k;
  const packetButtons = anyMsg.querySelectorAll(".acts button").filter(b => /packet/i.test(b.textContent));
  ok("P3a exactly ONE packet control per message",
     packetButtons.length === 1, packetButtons.map(b => b.textContent).join(" | "));
  ok("P3b the disclosure no longer offers a second affordance of its own",
     /\.pk > details > summary \{ display: none; \}/.test(css));
  ok("P3c closed, the packet holder draws no box",
     anyMsg.querySelector(".pk").className === "pk", anyMsg.querySelector(".pk").className);
  RT.act.togglePacket(pkKey);
  const opened = stream.querySelectorAll('[data-k="' + pkKey + '"]')[0];
  ok("P3d one click opens the same disclosure, with the packet verbatim",
     !!opened && opened.open === true && opened.textContent.indexOf("ROUNDTABLE") > 0,
     JSON.stringify(String(opened && opened.textContent).slice(0, 44)));
  ok("P3e the evidence is in the document, never behind a tab",
     stream.querySelectorAll("details").filter(d => (d.dataset.k || "").indexOf("pk|") === 0).length >= 4,
     stream.querySelectorAll("details").filter(d => (d.dataset.k || "").indexOf("pk|") === 0).length + " packets present");
  RT.act.togglePacket(pkKey);

  /* =================================================================== P4 */
  const headText = () => stream.querySelector(".rounddiv").textContent;
  ok("P4a the round head reports N/M answered", /3\/3 answered/.test(headText()), JSON.stringify(headText()));
  ok("P4b no failure chip when nothing failed", headText().indexOf("failed") < 0);
  const r0 = RT.state.session.rounds[0].stage1;
  const keys0 = Object.keys(r0);
  r0[keys0[0]].status = "cancelled"; r0[keys0[1]].status = "error";
  RT.render.stream();
  ok("P4c failures are counted, and the count wears the status hue",
     /1\/3 answered/.test(headText()) && /2 failed/.test(headText()) &&
     stream.querySelector(".rounddiv").querySelectorAll(".p-error").length === 1,
     JSON.stringify(headText()));
  r0[keys0[0]].status = "done"; r0[keys0[1]].status = "done";
  RT.render.stream();

  /* =================================================================== P5 */
  RT.render.info();
  const order = ["Status roster", "Human decision", "Notes", "Effective configuration",
                 "Settings for the next session", "Export"];
  const at = order.map(h => info.textContent.indexOf(h));
  ok("P5a every info section is present", at.every(i => i >= 0), JSON.stringify(at));
  ok("P5b the decision reads directly under the roster, above configuration and settings",
     at[0] < at[1] && at[1] < at[2] && at[2] < at[3] && at[3] < at[4] && at[4] < at[5],
     order.map((h, i) => h + "@" + at[i]).join(" < "));

  /* =================================================================== P6 */
  RT.state.relay = {};
  RT.render.stream();
  const relayBtn = stream.querySelectorAll("button").filter(b => b.textContent === "Relay…")[0];
  ok("P6a the relay builder opens with no seats chosen before the click",
     RT.act.relayDraft(0).order.length === 0);
  relayBtn.click();
  ok("P6b opening Relay… preselects the seats that answered this round",
     RT.act.relayDraft(0).order.join(",") === RT.util.answeredSeats(0).join(",") &&
     RT.act.relayDraft(0).order.length === 3,
     RT.act.relayDraft(0).order.join(","));
  RT.act.relayDraft(0).order = ["glm"];
  relayBtn.click(); relayBtn.click();                 /* shut, then open again */
  ok("P6c an order the reader has edited is never overwritten",
     RT.act.relayDraft(0).order.join(",") === "glm", RT.act.relayDraft(0).order.join(","));
  RT.state.relay = {};
  RT.act.seedRelay(0, "a disagreement line", "a disagreement line");
  ok("P6d seeding from the transcript preselects too",
     RT.act.relayDraft(0).order.length === 3 && RT.act.relayDraft(0).open === true,
     RT.act.relayDraft(0).order.join(","));
  RT.state.relay = {};

  /* =================================================================== P7 */
  ok("P7a a fieldset inside a bordered card keeps no box of its own",
     /\.card > fieldset \{[^}]*border: 0[^}]*background: none/.test(css), ruleOf(css, ".card > fieldset"));
  ok("P7b the card is the only box: the packet, the errnote and code blocks are fills with no border of their own",
     ruleOf(css, ".packet").indexOf("border:") < 0 && ruleOf(css, ".errnote").indexOf("border:") < 0 &&
     ruleOf(css, ".prose pre").indexOf("border:") < 0);
  ok("P7c secondary threads are a raised fill (surface-2) on the canvas, never a bordered box around bordered cards",
     ruleOf(css, ".thread").indexOf("border:") < 0 && /background: var\(--surface-2\)/.test(ruleOf(css, ".thread")));

  /* =================================================================== G1 */
  RT.act.newSessionView();
  const d = RT.state.draft;
  d.mode = "persona";
  d.roles.bull = "gpt"; d.roles.bear = "gpt"; d.roles.risk = "glm";
  d.charters.bull = "B"; d.charters.bear = "E"; d.charters.risk = "R";
  RT.render.stream();
  const roleSelects = stream.querySelectorAll("select").filter(n => /-role-(bull|bear|risk)$/.test(n.dataset.k || ""));
  ok("G1a persona assignment is role-centric: one row per role, not per seat",
     roleSelects.length === 3 && stream.querySelectorAll("textarea").filter(n => /-charter-(bull|bear|risk)$/.test(n.dataset.k || "")).length === 3,
     roleSelects.map(s => s.dataset.k.replace(/.*-role-/, "")).join(","));
  const createBtn = () => stream.querySelectorAll("button").filter(b => b.dataset.k === "createbtn")[0];
  ok("G1b two roles on one seat DISABLES Create",
     createBtn().disabled === true, "disabled=" + createBtn().disabled);
  ok("G1c and says which two roles collided, inline, beside the button",
     /is both bull and bear/.test((stream.querySelectorAll("[data-k=createblock]")[0] || {}).textContent || ""),
     (stream.querySelectorAll("[data-k=createblock]")[0] || {}).textContent);
  const newPostsBefore = ctx.calls.filter(c => c.url === "/api/session/new").length;
  await RT.act.createSession("");
  ok("G1d the bad line-up never reaches the server",
     ctx.calls.filter(c => c.url === "/api/session/new").length === newPostsBefore, "0 requests spent");
  d.roles.bear = "kimi";
  RT.render.stream();
  ok("G1e three different seats re-enables Create",
     createBtn().disabled === false && stream.querySelectorAll("[data-k=createblock]").length === 0);
  const badLineup = await apiPost("/api/session/new", {
    mode: "persona",
    members: { gpt: { tier: "luna", role: "bull", charter: "B" }, kimi: { tier: "k3", role: "bull", charter: "E" },
               glm: { tier: "high", role: "risk", charter: "R" } }
  });
  ok("G1f the server 400 is still the backstop behind the form",
     badLineup.status === 400 && !!(badLineup.data || {}).field,
     "HTTP " + badLineup.status + " field " + (badLineup.data || {}).field);

  /* =================================================================== G9 */
  RT.act.newSessionView();
  RT.act.setComposer("Two seats only, roundtable.");
  RT.state.draft.members.glm.on = false;
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.session && Object.keys(RT.state.session.members).length === 2, "two-seat session");
  const sidB = RT.state.sid;
  RT.render.composer();
  const personaOpt = () => doc.getElementById("delivery").querySelectorAll("option").filter(o => o.value === "persona")[0];
  ok("G9a Persona step is disabled on a roundtable session",
     personaOpt().disabled === true && RT.state.delivery !== "persona", "disabled=" + personaOpt().disabled);

  /* =================================================================== G2 */
  ok("G2a addressable seats are the SESSION's members, not a hard-coded trio",
     RT.util.addressableSeats().join(",") === Object.keys(RT.state.session.members).join(",") &&
     RT.util.addressableSeats().join(",") === "gpt,kimi",
     RT.util.addressableSeats().join(","));
  ok("G2b a seat absent from this session is not addressable in it",
     RT.util.mentionsIn("@gpt @glm @kimi @nobody").join(",") === "gpt,kimi",
     RT.util.mentionsIn("@gpt @glm @kimi @nobody").join(","));
  ok("G2c the composer placeholder names this session's own seats",
     doc.getElementById("msg").placeholder.indexOf("@gpt @kimi") > 0 &&
     doc.getElementById("msg").placeholder.indexOf("@glm") < 0,
     JSON.stringify(doc.getElementById("msg").placeholder.slice(-42)));
  ok("G2d no seat trio survives in the served markup or as a SEAT_ORDER constant",
     body.indexOf("@gpt @kimi @glm") < 0 && served.html.indexOf("SEAT_ORDER") < 0);
  /* Aesthetic pass adds display-only Claude and You identities. This list
     still grants no seat membership or server capability. */
  ok("G2e the remaining seat literal is the expanded PALETTE list, and it says so",
     /PALETTE ONLY[\s\S]{0,320}const TILE_SEATS = \["gpt", "kimi", "claude", "glm", "you"\]/.test(served.html));
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sidA, "back on session A");
  const savedQ = RT.state.session.rounds[0].question;
  RT.state.session.rounds[0].question = "@gpt @glm @kimi @nobody — which of you is wrong?";
  RT.render.stream();
  /* SVG initials are decorative; address matching belongs to the visible
     mention label, not the concatenated textContent of its hidden picture. */
  const marks = stream.querySelectorAll(".mention").map(n => n.children[n.children.length - 1].textContent);
  ok("G2f a rendered question marks the session's members and nothing else",
     marks.length === 3 && marks.join(",") === "@gpt,@glm,@kimi" &&
     marks.every(m => RT.util.addressableSeats().indexOf(m.slice(1).toLowerCase()) >= 0) &&
     stream.textContent.indexOf("@nobody") >= 0,
     marks.join(",") + " (of 4 @tokens in the text)");
  RT.state.session.rounds[0].question = savedQ;
  RT.render.stream();

  /* =================================================================== G3 */
  const cfg = RT.state.config;
  const knob = cfg.seats.gpt.knobs.timeout_s;
  const savedMin = knob.min, savedMax = knob.max;
  delete knob.min; delete knob.max;                 /* the server stops publishing them */
  RT.state.draft = null; RT.state.next = null;
  RT.act.newSessionView();
  const tmo = () => stream.querySelectorAll("input").filter(n => /gpt-timeout_s$/.test(n.dataset.k || ""))[0];
  ok("G3a with no knob min/max the field falls back to ranges.timeout_s",
     tmo().min === "60" && tmo().max === "3600", tmo().min + "–" + tmo().max);
  cfg.ranges.timeout_s = [30, 7200];
  RT.state.draft = null;
  RT.act.newSessionView();
  ok("G3b widening ranges.timeout_s widens the field, with no edit to the page",
     tmo().min === "30" && tmo().max === "7200", tmo().min + "–" + tmo().max);
  ok("G3c the range is annotated on the label from the same source",
     stream.textContent.indexOf("timeout_s · 30–7200") >= 0);
  ok("G3d nothing in the page hard-codes the old range",
     !/\b60,\s*3600\b/.test(served.html) && !/timeout_s.*\|\|.*\[60, 3600\]/.test(served.html));
  cfg.ranges.timeout_s = [60, 3600];
  knob.min = savedMin; knob.max = savedMax;
  ok("G3e bounds are iterated generically from ranges.bounds, never named",
     /Object\.keys\(ranges\)\.forEach/.test(served.html) &&
     /the bound NAMES come from ranges\.bounds/.test(served.html));

  /* =================================================================== G4 */
  cfg.seats.gpt.knobs.temperature = { type: "enum", values: ["cold", "warm", "hot"], default: null, env: "FAKE_TEMPERATURE" };
  cfg.seats.kimi.knobs.retries = { type: "int", min: 0, max: 9, default: 2, env: "FAKE_RETRIES" };
  cfg.seats.glm.knobs.house_style = { type: "text", max_len: 400 };
  RT.state.draft = null; RT.state.next = null;
  RT.act.newSessionView();
  const pickN = (tag, re) => stream.querySelectorAll(tag).filter(n => re.test(n.dataset.k || ""))[0];
  const tempSel = pickN("select", /gpt-temperature$/);
  const retries = pickN("input", /kimi-retries$/);
  const houseStyle = pickN("textarea", /glm-house_style$/);
  ok("G4a a knob the page has NEVER heard of renders by type — enum",
     !!tempSel && tempSel.querySelectorAll("option").length === 4 &&
     tempSel.querySelectorAll("option")[0].textContent === "(server default)",
     tempSel ? tempSel.querySelectorAll("option").map(o => o.textContent).join("|") : "missing");
  ok("G4b — int, bounded, with the server default as the placeholder",
     !!retries && retries.type === "number" && retries.min === "0" && retries.max === "9" &&
     retries.placeholder === "server default 2", retries ? retries.min + "–" + retries.max : "missing");
  ok("G4c — text", !!houseStyle && houseStyle.tagName === "TEXTAREA");
  ok("G4d every knob the server publishes for a seat is rendered for that seat",
     stream.querySelectorAll("input,select,textarea")
       .filter(n => /-gpt-(effort|timeout_s|temperature)$/.test(n.dataset.k || "")).length === 3,
     Object.keys(cfg.seats.gpt.knobs).filter(k => k !== "role" && k !== "charter").join(","));
  tempSel.value = "hot"; tempSel.dispatchEvent({ type: "change", target: tempSel });
  typeInto(retries, "7");
  const payload = RT.act.buildCreatePayload();
  ok("G4e the unknown knobs reach the create payload, correctly typed",
     payload.members.gpt.temperature === "hot" && payload.members.kimi.retries === 7,
     JSON.stringify({ t: payload.members.gpt.temperature, r: payload.members.kimi.retries }));
  ok("G4f B's range annotation and rationale copy survive the generic rendering",
     stream.textContent.indexOf("retries · 0–9 · FAKE_RETRIES") >= 0 &&
     stream.textContent.indexOf("an unbounded packet has returned an empty answer") >= 0);

  /* =================================================================== G7 */
  RT.render.info();
  const infoField = (tag, re) => info.querySelectorAll(tag).filter(n => re.test(n.dataset.k || ""))[0];
  const nextTemp = infoField("select", /^draft-next-gpt-temperature$/);
  const nextBound = infoField("input", /^draft-next-bound-stage1$/);
  const nextReader = infoField("select", /^draft-next-reader$/);
  const nextTier = infoField("select", /^draft-next-tier-kimi$/);
  ok("G7a the next-session pane carries MEMBER knobs, editable",
     !!nextTemp && !!nextTier && info.querySelectorAll(".memberbox").length >= 3,
     info.querySelectorAll(".memberbox").length + " member boxes");
  ok("G7b it carries PROTOCOL rows too, editable",
     !!nextBound && !!nextReader && info.querySelectorAll("input")
       .filter(n => /^draft-next-(anonymize-review|stop_on_error|live_log)$/.test(n.dataset.k || "")).length === 3);
  nextTemp.value = "cold"; nextTemp.dispatchEvent({ type: "change", target: nextTemp });
  typeInto(nextBound, "777");
  info.querySelectorAll("button").filter(b => b.textContent === "Save as the default")[0].click();
  RT.act.newSessionView();
  ok("G7c what is edited there seeds the New-session form",
     RT.state.draft.members.gpt.knobs.temperature === "cold" && RT.state.draft.protocol.bounds.stage1 === 777,
     JSON.stringify({ temp: RT.state.draft.members.gpt.knobs.temperature, stage1: RT.state.draft.protocol.bounds.stage1 }));
  ctx.sandbox.localStorage.removeItem("rt2.nextdraft");
  delete cfg.seats.gpt.knobs.temperature; delete cfg.seats.kimi.knobs.retries; delete cfg.seats.glm.knobs.house_style;
  RT.state.next = null; RT.state.draft = null;

  /* =================================================================== G8 */
  RT.act.newSessionView();
  const pd = RT.state.draft;
  pd.mode = "persona";
  pd.roles.bull = "gpt"; pd.roles.bear = "kimi"; pd.roles.risk = "glm";
  pd.charters.bull = "Bull."; pd.charters.bear = "Bear."; pd.charters.risk = "Risk.";
  RT.act.setComposer("A persona session, for the decision fields.");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.session && RT.state.session.mode === "persona", "persona session");
  const sidP = RT.state.sid;
  await until(async () => {
    const s = await apiGet("/api/session/" + sidP);
    return Object.keys(((s.rounds || [])[0] || {}).stage1 || {}).length === 3;
  }, "briefs", 30000);
  await RT.act.refetch(sidP, RT.state.gen);
  RT.render.info();
  const fieldsBefore = {};
  [["decision-stance", "reject"], ["decision-rationale", "Two seats agreeing is not evidence."],
   ["decision-dissent", "The bear seat's fill assumption is unchecked."],
   ["notes", "and a note, also unsaved"]].forEach(pair => {
    const n = doc.querySelector('[data-k="' + pair[0] + '"]');
    fieldsBefore[pair[0]] = n;
    n.focus(); n.value = pair[1];
    n.dispatchEvent({ type: pair[0] === "decision-stance" ? "change" : "input", target: n });
    n.blur();
  });
  doc.activeElement = doc.body;                        /* NOTHING is focused */
  await RT.act.refetch(RT.state.sid, RT.state.gen);
  const survived = Object.keys(fieldsBefore).every(k => {
    const n = doc.querySelector('[data-k="' + k + '"]');
    return n === fieldsBefore[k] && RT.util.fieldDirty(k) === true;
  });
  ok("G8a the editing guard covers decision stance, rationale, dissent AND notes",
     survived,
     Object.keys(fieldsBefore).map(k => k + "=" + JSON.stringify(String(doc.querySelector('[data-k="' + k + '"]').value).slice(0, 18))).join(" "));
  ok("G8b the pane says the judgment fields are unsaved", info.textContent.indexOf("unsaved") >= 0);
  RT.render.composer();
  ok("G9b Persona step IS available on a persona session",
     personaOpt().disabled === false, "disabled=" + personaOpt().disabled);

  /* =================================================================== G6 */
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sidA, "session A");
  RT.render.stream();
  const rnd0 = RT.state.session.rounds[0];
  const relayRun = rnd0.relays[rnd0.relays.length - 1];
  const topicMark = "topic: " + relayRun.prompt.slice(0, 20);
  const revResults = (rnd0.review || {}).results || {};
  const revStamp = Math.min.apply(Math, Object.keys(revResults).map(k => Date.parse(revResults[k].started_at)));
  const where = () => {
    const t = stream.textContent;
    return { relay: t.indexOf(topicMark), review: t.indexOf("Rank matrix"), t: t };
  };
  const w0 = where();
  ok("G6a the transcript follows the record's own clock, not a fixed stage order",
     (Date.parse(relayRun.entries[0].started_at) < revStamp) === (w0.relay < w0.review),
     "relay started " + relayRun.entries[0].started_at + " · review " + new Date(revStamp).toISOString() +
     " · rendered relay@" + w0.relay + " review@" + w0.review);
  relayRun.entries[0].started_at = "2099-01-01T00:00:00-0500";
  RT.render.stream();
  const w1 = where();
  ok("G6b pushing the relay's clock past the review moves it after the review",
     w1.relay > w1.review, "relay@" + w1.relay + " review@" + w1.review);
  relayRun.entries[0].started_at = "2000-01-01T00:00:00-0500";
  RT.render.stream();
  const w2 = where();
  ok("G6c rewinding it moves it back in front, on the same record",
     w2.relay < w2.review, "relay@" + w2.relay + " review@" + w2.review);
  ok("G6d stage 1 is still first and the round's controls are still last",
     w2.t.indexOf("Round started") < w2.relay &&
     w2.t.indexOf("Stage actions for round 1") > w2.review);

  /* =================================================================== C3/C4 */
  const ghost = "0d7d20f0deadbeef";
  const ctx2 = H.makeContext(served.html, () => {});
  ctx2.sandbox.window.location.search = "?session=" + ghost;
  const RT2 = ctx2.sandbox.RT, doc2 = ctx2.doc;
  await RT2.boot();
  await H.waitFor(() => RT2.state.config, "config on the second context");
  const flash2 = () => doc2.getElementById("flash").textContent;
  ok("C3a an unknown ?session= id is reported, and the id is named",
     /did not load/.test(flash2()) && flash2().indexOf("0d7d20f0") >= 0, flash2().replace("Dismiss", "").trim());
  ok("C3b the line is dismissable",
     doc2.getElementById("flash").querySelectorAll("button").filter(b => b.textContent === "Dismiss").length === 1);
  ok("C3c the page still lands on the list, not on a dead end",
     RT2.state.view === "empty" && doc2.querySelectorAll(".srow").length >= 1,
     RT2.state.view + " · " + doc2.querySelectorAll(".srow").length + " session rows");
  await RT2.act.selectSession(sidA);
  await H.waitFor(() => RT2.state.session && RT2.state.session.id === sidA, "second context loads A");
  ok("C4a the stale notice clears the moment a session DOES load",
     flash2().trim() === "", JSON.stringify(flash2()));
  RT2.act.flash("Session 0d7d20f0 did not load — no session with that id is in this server's list.", "err", "sessionload");
  doc2.getElementById("flash").querySelectorAll("button").filter(b => b.textContent === "Dismiss")[0].click();
  ok("C4b and it clears on Dismiss", flash2().trim() === "");
  RT2.act.flash("Wrote /somewhere/session.md", "ok");
  RT2.act.clearFlashTag("sessionload");
  ok("C4c clearing the stale notice never swallows someone else's line",
     flash2().indexOf("Wrote") >= 0, flash2().replace("Dismiss", "").trim());
  ctx2.streams.forEach(s => s.close());
  if (RT2.state.tickTimer) clearInterval(RT2.state.tickTimer);
  if (RT2.state.refetchTimer) clearTimeout(RT2.state.refetchTimer);

  /* =================================================================== M1/M2 */
  const ctx3 = H.makeContext(served.html, () => {}, { innerWidth: 380 });
  const RT3 = ctx3.sandbox.RT, doc3 = ctx3.doc, app3 = doc3.getElementById("app");
  await RT3.boot();
  await H.waitFor(() => RT3.state.config, "config on the narrow context");
  ok("M1a at 380px the page knows it is in drawer mode", RT3.util.narrow() === true);
  ok("M1b each drawer carries a visible close control",
     !!doc3.getElementById("btnCloseSidebar") &&
     doc3.getElementById("info").querySelectorAll('[data-k="closeinfo"]').length === 1);
  RT3.act.setPane("sidebar", true);
  ok("M1c the sessions drawer opens", app3.dataset.sidebar === "on");
  RT3.act.setPane("info", true);
  ok("M1d opening one drawer closes the other",
     app3.dataset.info === "on" && app3.dataset.sidebar === "off",
     "sidebar=" + app3.dataset.sidebar + " info=" + app3.dataset.info);
  const keyHandlers = doc3._listeners.keydown || [];
  ok("M1e a global key handler is wired on the document", keyHandlers.length >= 1, keyHandlers.length + " handler(s)");
  keyHandlers[0]({ key: "Escape", preventDefault: function () {} });
  ok("M1f Escape dismisses the open drawer",
     app3.dataset.info === "off" && app3.dataset.sidebar === "off",
     "sidebar=" + app3.dataset.sidebar + " info=" + app3.dataset.info);
  RT3.act.setPane("sidebar", true);
  doc3.getElementById("btnCloseSidebar").click();
  ok("M1g the close control dismisses it too", app3.dataset.sidebar === "off");
  RT3.act.setPane("sidebar", true);
  RT3.act.newSessionView();
  ok("M1h New session shuts the drawer it was launched from",
     app3.dataset.sidebar === "off" && app3.dataset.info === "off",
     "sidebar=" + app3.dataset.sidebar + " info=" + app3.dataset.info);
  ok("M1i a drawer can never cover its own toggle: the header outranks it and the overlay starts below it",
     /#topbar \{[^}]*z-index: 40/.test(css) && /#fakebar \{[^}]*z-index: 40/.test(css) &&
     /@media \(max-width: 980px\)[\s\S]*?#sidebar, #info \{[^}]*top: var\(--chrome-h, 41px\)/.test(css) &&
     /#sidebar, #info \{[^}]*z-index: 30/.test(css.slice(css.indexOf("@media (max-width: 980px)"))));
  ok("M1j the ceiling is measured, not guessed, so the fake band is accounted for",
     app3.style["--chrome-h"] === "41px" && /getBoundingClientRect/.test(served.html),
     "--chrome-h = " + app3.style["--chrome-h"]);
  ok("M2a the header wraps at narrow widths instead of squeezing the controls",
     /@media \(max-width: 700px\) \{[\s\S]*?#topbar \{ flex-wrap: wrap/.test(css));
  ok("M2b the theme control and both pane toggles are exempt from shrinking",
     /#topbar \.seg, #topbar #btnSidebar, #topbar #btnInfo \{ flex: 0 0 auto; \}/.test(css));
  ok("M2c the title takes its own row rather than crushing the theme control",
     /#topbar \.title \{ order: 5; flex: 1 1 100%/.test(css));
  ok("M2d all three theme values are still present, unabbreviated",
     body.indexOf(">System<") > 0 && body.indexOf(">Light<") > 0 && body.indexOf(">Dark<") > 0);
  ctx3.streams.forEach(s => s.close());
  if (RT3.state.tickTimer) clearInterval(RT3.state.tickTimer);
  if (RT3.state.refetchTimer) clearTimeout(RT3.state.refetchTimer);

  /* ------------------------------------------------- standing law, re-checked */
  ok("M3a the file still asks the network for nothing but its own API",
     !/https?:\/\/(?!127\.0\.0\.1)/.test(served.html.replace(/https?:\/\/(www\.)?w3\.org[^"']*/g, "")) &&
     served.html.indexOf("@import") < 0 && served.html.indexOf("<link") < 0);
  ok("M3b overflow-x is clipped on html and body, and no transition: all survives",
     /overflow-x: clip;/.test(ruleOf(css, "html, body")) && !/transition:\s*all\b/.test(css));
  ok("M3c reduced motion is still respected",
     /@media \(prefers-reduced-motion: reduce\)/.test(css));
  ok("M3d the token line the server rewrites is byte-for-byte intact",
     /const API_TOKEN = "[^"]+";/.test(served.html) &&
     /const API_TOKEN = "__ROUNDTABLE_TOKEN__";/.test(H.readUI()));

  console.log("\nRESULT: " + (fail === 0 ? "PASS" : "FAIL") + "  (" + pass + " passed, " + fail + " failed)");
  if (notes.length) console.log("NOTES: " + notes.join(" | "));
  ctx.streams.forEach(s => s.close());
  if (RT.state.tickTimer) clearInterval(RT.state.tickTimer);
  if (RT.state.notesTimer) clearTimeout(RT.state.notesTimer);
  if (RT.state.refetchTimer) clearTimeout(RT.state.refetchTimer);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("HARNESS ERROR: " + e.stack); process.exit(2); });
