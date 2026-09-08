/* Round-five punch list: R1-R2 (round-four regressions), L1-L6, C1-C4, T1-T3.
   The id is the first token of every label.

   THE RULE FOR THIS SUITE: every check is a TRANSITION. Round four wrote 121
   state snapshots and both regressions walked straight through them — the packet
   button existed (in one builder), the Run-relay button computed a correct
   disabled state (once, at render). A snapshot cannot see a control that never
   updates, because the snapshot IS the update. So each check below does
   something and asserts the change: BEFORE is recorded, an interaction fires,
   AFTER is asserted, and where the fix is "do not rebuild the node", node
   IDENTITY across the interaction is part of the assertion.

   The CSS-law items (L1, L3, T2, T3) also carry a static assertion about the
   served stylesheet, because a stub DOM runs no CSS and no interaction can
   observe a colour. Those are labelled `-css` and are stated as such in the
   report; every one of them is paired with a behavioural check that proves the
   rule reaches a real node. */
"use strict";
const H = require("./harness.js");

let pass = 0, fail = 0;
function ok(l, c, d) {
  if (c) { pass++; console.log("PASS  " + l + (d ? "  [" + d + "]" : "")); }
  else { fail++; console.log("FAIL  " + l + (d ? "  [" + d + "]" : "")); }
}
function note(s) { console.log("NOTE  " + s); }

/* A keystroke, as the browser delivers it: the node keeps its identity, the
   caret is where the reader left it, and only `input` fires. */
function typeAt(node, text, caret) {
  node.focus();
  node.value = text;
  const at = caret == null ? text.length : caret;
  node.selectionStart = at; node.selectionEnd = at;
  node.dispatchEvent({ type: "input", target: node });
}
/* the stub's setSelectionRange is a no-op; give it a memory so a rebuild that
   DOES happen is still measurable rather than silently passing */
function caretAware(node) {
  node.setSelectionRange = function (a, b) { this.selectionStart = a; this.selectionEnd = b; };
  return node;
}
function ruleOf(css, sel) {
  const re = new RegExp("(^|\\n)" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = re.exec(css);
  return m ? m[2].trim().replace(/\s+/g, " ") : null;
}
function tokenIn(css, header, name, span) {
  const at = css.indexOf(header);
  if (at < 0) return null;
  const chunk = css.slice(at, at + (span || 1700));
  const m = new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})").exec(chunk);
  return m ? m[1] : null;
}
const THEMES = [
  ["light system", ":root {"],
  ["dark system", "@media (prefers-color-scheme: dark) {"],
  ["light forced", ':root[data-theme="light"] {'],
  ["dark forced", ':root[data-theme="dark"] {']
];
let TOKEN = "";
async function apiGet(path) {
  const r = await fetch(H.BASE + path, { headers: { "X-Roundtable": TOKEN } });
  return await r.json();
}
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

(async () => {
  const served = await H.loadServedPage();
  TOKEN = /const API_TOKEN = "([^"]+)"/.exec(served.html)[1];
  const css = /<style>([\s\S]*?)<\/style>/.exec(served.html)[1];
  const bodyHtml = /<body>([\s\S]*?)<\/body>/.exec(served.html)[1];

  const ctx = H.makeContext(served.html, () => {});
  const RT = ctx.sandbox.RT, doc = ctx.doc;
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

  /* ==================================================================== R1
     The disagreements packet. Round four hid every `.pk > details > summary`
     and wired the replacement button only inside `messageActions` — which the
     disagreements card does not call. Transition: closed -> open, driven from
     the card's OWN control, asserting the packet text is on the page after. */
  await RT.act.runDisagreements(0);
  await H.waitFor(() => (RT.state.session.rounds[0] || {}).disagreements, "disagreements extracted");
  await until(async () => {
    const s = await apiGet("/api/session/" + sidA);
    return !!((s.rounds[0] || {}).disagreements || {}).packet;
  }, "disagreements packet on the record");
  await RT.act.refetch(sidA, RT.state.gen);
  const disPacket = RT.state.session.rounds[0].disagreements.packet;
  const disKey = "pk|dis|0|-1";
  const disCard = () => stream.querySelectorAll(".msg").filter(m => m.textContent.indexOf("Disagreements") >= 0)[0];
  const disReveal = () => stream.querySelectorAll("button").filter(b => b.dataset.k === "reveal|" + disKey)[0];
  const disDetails = () => stream.querySelectorAll("details").filter(d => d.dataset.k === disKey)[0];

  ok("R1a the disagreements card HAS a reveal control of its own (it had none)",
     !!disCard() && !!disReveal() && disCard().contains(disReveal()),
     disReveal() ? "control found inside the card" : "no control");
  const disBefore = { open: !!(disDetails() || {}).open, label: (disReveal() || {}).textContent };
  ok("R1b before the click the packet is closed and the control says Reveal",
     disBefore.open === false && disBefore.label === "Reveal packet",
     "open=" + disBefore.open + " label=" + disBefore.label);
  disReveal().click();
  const disAfter = disDetails();
  ok("R1c TRANSITION: clicking the card's control opens the packet and the verbatim prompt is on the page",
     !!disAfter && disAfter.open === true &&
     disAfter.textContent.indexOf(String(disPacket).slice(0, 60)) >= 0 &&
     disCard().textContent.indexOf(String(disPacket).slice(0, 60)) >= 0,
     "open=" + (disAfter && disAfter.open) + " packet chars=" + String(disPacket).length);
  ok("R1d the control flips to Hide, and flips the packet back shut",
     disReveal().textContent === "Hide packet" &&
     (disReveal().click(), !(disDetails() || {}).open) &&
     disReveal().textContent === "Reveal packet",
     "round trip closed");
  disReveal().click();          /* leave it open for the audit below */

  /* the audit the regression asked for: EVERY packet holder, one control each */
  await RT.act.runReview(0);
  await H.waitFor(() => Object.keys(((RT.state.session.rounds[0].review) || {}).results || {}).length >= 1, "a review result");
  await RT.act.refetch(sidA, RT.state.gen);
  RT.act.relayDraft(0).order = RT.util.answeredSeats(0).slice(0, 2);
  RT.act.relayDraft(0).prompt = "which cost line is the one that actually moves?";
  await RT.act.runRelay(0);
  await until(async () => {
    const s = await apiGet("/api/session/" + sidA);
    return ((s.rounds[0].relays || [])[0] || {}).entries && s.rounds[0].relays[0].entries.length >= 1;
  }, "a relay entry");
  await RT.act.refetch(sidA, RT.state.gen);
  RT.render.stream();
  const holders = stream.querySelectorAll("details").filter(d => String(d.dataset.k || "").indexOf("pk|") === 0);
  const controls = stream.querySelectorAll("button").filter(b => String(b.dataset.k || "").indexOf("reveal|") === 0);
  const orphans = holders.filter(d => controls.filter(b => b.dataset.k === "reveal|" + d.dataset.k).length !== 1);
  const doubles = controls.filter(b => controls.filter(c => c.dataset.k === b.dataset.k).length !== 1);
  ok("R1e every packet on the page has EXACTLY ONE reveal control — none orphaned, none doubled",
     holders.length >= 4 && orphans.length === 0 && doubles.length === 0,
     holders.length + " packets · " + controls.length + " controls · " + orphans.length + " orphaned");
  ok("R1f the suppressed <details> summary is still suppressed (one door, not two)",
     /\.pk > details > summary \{[^}]*display: none/.test(css),
     ruleOf(css, ".pk > details > summary"));

  /* ==================================================================== R2
     Form readiness recomputed on input, without rebuilding the field being
     typed into. Two forms: the relay builder, and the persona create form. */
  /* the relay above must be finished before the readiness test: `busy()` is one
     of the three things Run relay consults, and a running stage disables it for
     a reason that has nothing to do with what is typed. */
  await until(async () => {
    const s = await apiGet("/api/session/" + sidA);
    return !(s.rounds[0].relays || []).some(r => r.status === "running");
  }, "the relay to settle");
  await RT.act.refetch(sidA, RT.state.gen);
  await H.waitFor(() => RT.state.live.size === 0 && RT.state.inflight === 0, "the page to go idle");
  RT.act.openRelayFor(0);
  const draft0 = RT.act.relayDraft(0);
  draft0.order = RT.util.answeredSeats(0).slice(0, 2);
  draft0.prompt = "";
  RT.render.stream();
  const relayRun = () => stream.querySelectorAll("button").filter(b => b.dataset.k === "relayrun-0")[0];
  const relayWhy = () => stream.querySelectorAll("[data-k=relaywhy-0]")[0];
  const relayField = () => stream.querySelectorAll("textarea").filter(t => t.dataset.k === "relayprompt-0")[0];
  const runBefore = relayRun(), fieldBefore = caretAware(relayField());
  ok("R2a two seats picked and no topic: Run relay is off and says why",
     !!runBefore && runBefore.disabled === true && /topic/.test(relayWhy().textContent),
     "disabled=" + runBefore.disabled + " why=" + relayWhy().textContent);
  typeAt(fieldBefore, "which cost line dominates?", 5);
  const runAfter = relayRun(), fieldAfter = relayField();
  ok("R2b TRANSITION: typing the topic re-enables Run relay on the same render",
     runAfter.disabled === false, "disabled=" + runAfter.disabled);
  ok("R2c the blocker line is gone with it",
     !/at least two seats/.test(relayWhy().textContent) && !/topic/.test(relayWhy().textContent),
     relayWhy().textContent);
  ok("R2d the textarea was NOT rebuilt: same node, still focused, caret where it was",
     fieldAfter === fieldBefore && doc.activeElement === fieldBefore &&
     fieldBefore.selectionStart === 5 && fieldBefore.value === "which cost line dominates?",
     "same node=" + (fieldAfter === fieldBefore) + " caret=" + fieldBefore.selectionStart);
  ok("R2e emptying the topic again turns Run relay back off (the recompute runs both ways)",
     (typeAt(fieldBefore, "", 0), relayRun().disabled === true),
     "disabled=" + relayRun().disabled);
  draft0.open = false;

  /* --- the persona create form ---------------------------------------- */
  RT.act.newSessionView();
  const d = RT.state.draft;
  d.mode = "persona";
  d.roles.bull = "gpt"; d.roles.bear = "kimi"; d.roles.risk = "glm";
  d.charters.bull = "Argue the upside from the fee schedule."; d.charters.bear = "Argue the downside from slippage.";
  d.charters.risk = "";
  RT.render.stream();
  const createBtn = () => stream.querySelectorAll("button").filter(b => b.dataset.k === "createbtn")[0];
  const blockLine = () => stream.querySelectorAll("[data-k=createblock]")[0];
  const riskField = () => stream.querySelectorAll("textarea").filter(t => /-charter-risk$/.test(t.dataset.k || ""))[0];
  const createBefore = createBtn(), riskBefore = caretAware(riskField());
  ok("R2f the third charter empty: Create is off and the blocker names it",
     createBefore.disabled === true && !!blockLine() && /charter/.test(blockLine().textContent),
     "disabled=" + createBefore.disabled + " · " + (blockLine() || {}).textContent);
  typeAt(riskBefore, "Name the exposure the other two are pricing at zero.", 4);
  ok("R2g TRANSITION: finishing the charter enables Create on the keystroke",
     createBtn().disabled === false, "disabled=" + createBtn().disabled);
  ok("R2h and the blocker line is removed from the page, not just emptied",
     stream.querySelectorAll("[data-k=createblock]").length === 0,
     stream.querySelectorAll("[data-k=createblock]").length + " blocker nodes");
  ok("R2i the charter textarea was NOT rebuilt: same node, still focused, caret held",
     riskField() === riskBefore && doc.activeElement === riskBefore && riskBefore.selectionStart === 4,
     "same node=" + (riskField() === riskBefore) + " caret=" + riskBefore.selectionStart);
  ok("R2j Create is the same button object throughout — the form was not re-rendered under the reader",
     createBtn() === createBefore, "same node=" + (createBtn() === createBefore));
  ok("R2k clearing the charter again puts the blocker back (both directions)",
     (typeAt(riskBefore, "", 0), createBtn().disabled === true && !!blockLine()),
     "disabled=" + createBtn().disabled + " blocker=" + !!blockLine());
  typeAt(riskBefore, "Name the exposure the other two are pricing at zero.", 4);
  ok("R2l the audit: no `input` handler on a gating field mutates state without a recompute",
     /prompt\.addEventListener\("input", \(\) => \{ draft\.prompt = prompt\.value; draft\.trimmed = null; syncRelayReady\(\); \}\)/.test(served.html) &&
     /t\.addEventListener\("input", \(\) => \{ d\.charters\[role\] = t\.value; syncCreateReady\(\); \}\)/.test(served.html),
     "both gating handlers call their sync");

  /* ==================================================================== C4
     Create lock. Both controls, one request. Fire two creates without
     awaiting the first and count the POSTs the page actually made. */
  const newBefore = ctx.calls.filter(c => c.url === "/api/session/new").length;
  const sessionsBefore = (await apiGet("/api/sessions")).length;
  const first = RT.act.createSession("");
  const lockedBtn = createBtn(), lockedSend = doc.getElementById("btnSend");
  ok("C4a TRANSITION: the create is in flight and BOTH Create controls went disabled",
     lockedBtn.disabled === true && lockedSend.disabled === true && RT.state.creating === true,
     "form=" + lockedBtn.disabled + " composer=" + lockedSend.disabled);
  const second = RT.act.createSession("");        /* Enter, twice */
  const secondResult = await second;
  const firstId = await first;
  ok("C4b the second invocation short-circuits and creates nothing",
     secondResult === null && typeof firstId === "string",
     "second=" + String(secondResult) + " first=" + String(firstId).slice(0, 8));
  ok("C4c exactly ONE POST /api/session/new left the page",
     ctx.calls.filter(c => c.url === "/api/session/new").length - newBefore === 1,
     (ctx.calls.filter(c => c.url === "/api/session/new").length - newBefore) + " requests");
  const sessionsAfter = (await apiGet("/api/sessions")).length;
  ok("C4d the server holds exactly ONE new session, not two",
     sessionsAfter - sessionsBefore === 1, (sessionsAfter - sessionsBefore) + " new sessions");
  RT.act.newSessionView();
  RT.render.composer();
  ok("C4e TRANSITION: the lock is released afterwards — both Create controls work again",
     RT.state.creating === false && doc.getElementById("btnSend").disabled === false &&
     createBtn().disabled === false,
     "creating=" + RT.state.creating + " composer=" + doc.getElementById("btnSend").disabled +
     " form=" + createBtn().disabled);

  /* ==================================================================== L4
     Focus survives a transcript rebuild. Focus an action button, fire a seat
     event, assert the focus is still on THAT action of THAT message. */
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sidA, "back on A");
  RT.render.stream();
  const actButtons = stream.querySelectorAll("button").filter(b => String(b.dataset.k || "").indexOf("act|") === 0);
  ok("L4a every message-action button now carries a stable data-k (it carried none)",
     actButtons.length >= 12 && actButtons.every(b => /^act\|[a-z]+\|/.test(b.dataset.k)),
     actButtons.length + " keyed action buttons");
  const replyBtn = actButtons.filter(b => b.dataset.k.indexOf("act|reply|pk|s1|0|") === 0)[0];
  const replyKey = replyBtn.dataset.k;
  replyBtn.focus();
  ok("L4b before the rebuild the focus is on that Reply button",
     doc.activeElement === replyBtn && doc.activeElement.dataset.k === replyKey, replyKey);
  const rec = RT.state.session.rounds[0].stage1.kimi;
  RT.act.handleEvent({ type: "seat_started", stage: "stage1", seat: "kimi", round: 0,
                       run_id: "aaaaaaaabbbbcccc", tier: rec.tier }, sidA, RT.state.gen);
  RT.render.stream();
  const afterNodes = stream.querySelectorAll("button").filter(b => b.dataset.k === replyKey);
  ok("L4c TRANSITION: a seat event rebuilt the transcript and focus is still on that Reply button",
     afterNodes.length === 1 && doc.activeElement === afterNodes[0] &&
     doc.activeElement.dataset.k === replyKey && afterNodes[0] !== replyBtn,
     "focused=" + (doc.activeElement && doc.activeElement.dataset.k) + " node replaced=" + (afterNodes[0] !== replyBtn));
  RT.state.live.clear();
  await RT.act.refetch(sidA, RT.state.gen);

  /* ==================================================================== L5
     Roster status truth. The fallback read the last round's stage1 only, so a
     seat that died in a LATER step still showed the stage-1 "done". */
  const rosterPill = seat => {
    const rows = info.querySelectorAll(".rosterrow").filter(r => r.textContent.indexOf(RT.state.session.members[seat] ? seat : "@@") >= 0);
    const row = rows.filter(r => (r.querySelector(".mono-tile") || {}).textContent !== undefined)[0];
    return row ? (row.querySelector(".pill") || {}).className : null;
  };
  const rosterRowFor = seat => info.querySelectorAll(".rosterrow")
    .filter(r => (r.querySelector(".mono-tile") || {}).textContent === (RT.state.config.seats[seat].label || "").slice(0, 4))[0];
  RT.render.info();
  const relaySeat = RT.state.session.rounds[0].relays[0].order[0];
  const beforeRow = info.querySelectorAll(".rosterrow").filter(r => r.textContent.indexOf(RT.state.config.seats[relaySeat].label) >= 0)[0];
  const beforeCls = (beforeRow.querySelector(".pill") || {}).className;
  ok("L5a before: that seat's last visible state is the done stage-1 answer",
     /p-done/.test(beforeCls || ""), beforeCls);
  /* the relay child for that seat dies, chronologically after the stage-1 answer */
  const entry = RT.state.session.rounds[0].relays[0].entries.filter(e => e.seat === relaySeat)[0];
  entry.status = "error";
  entry.started_at = new Date(Date.parse(RT.state.session.rounds[0].stage1[relaySeat].started_at) + 60000).toISOString();
  RT.render.info();
  const afterRow = info.querySelectorAll(".rosterrow").filter(r => r.textContent.indexOf(RT.state.config.seats[relaySeat].label) >= 0)[0];
  const afterCls = (afterRow.querySelector(".pill") || {}).className;
  ok("L5b TRANSITION: the roster follows the seat's LAST result, so the failed relay child shows failed",
     /p-error/.test(afterCls || ""), afterCls);
  ok("L5c the seats that did not fail are untouched",
     RT.util.orderedSeats(Object.keys(RT.state.session.members)).filter(s => s !== relaySeat)
       .every(s => {
         const r = info.querySelectorAll(".rosterrow").filter(x => x.textContent.indexOf(RT.state.config.seats[s].label) >= 0)[0];
         return /p-done/.test(((r.querySelector(".pill") || {}).className) || "");
       }),
     "other seats still done");
  entry.status = "done";
  entry.started_at = RT.state.session.rounds[0].stage1[relaySeat].started_at;
  RT.render.info();
  ok("L5d TRANSITION back: repairing the last result puts the roster back to done",
     /p-done/.test((((info.querySelectorAll(".rosterrow")
       .filter(r => r.textContent.indexOf(RT.state.config.seats[relaySeat].label) >= 0)[0]
       .querySelector(".pill")) || {}).className) || ""),
     "restored");
  ok("L5e a review result later than stage 1 also reaches the roster",
     (() => {
       const revSeat = Object.keys(RT.state.session.rounds[0].review.results)[0];
       const rv = RT.state.session.rounds[0].review.results[revSeat];
       const was = rv.status, wasAt = rv.started_at;
       rv.status = "timed_out";
       rv.started_at = new Date(Date.parse(RT.state.session.rounds[0].stage1[revSeat].started_at) + 120000).toISOString();
       RT.render.info();
       const row = info.querySelectorAll(".rosterrow").filter(r => r.textContent.indexOf(RT.state.config.seats[revSeat].label) >= 0)[0];
       const cls = ((row.querySelector(".pill") || {}).className) || "";
       rv.status = was; rv.started_at = wasAt; RT.render.info();
       return /p-timed_out/.test(cls);
     })(), "review timeout surfaces");

  /* ==================================================================== L6
     "the reviewer saw letters only" only when it is true. */
  RT.state.session.protocol.anonymize.review = true;
  RT.render.stream();
  const reviewBody = () => stream.querySelectorAll(".thread").filter(t => t.textContent.indexOf("Rank matrix") >= 0)[0];
  ok("L6a anonymised: the page says the reviewer saw letters only",
     /the reviewer saw letters only/.test(reviewBody().textContent), "anonymised wording");
  RT.state.session.protocol.anonymize.review = false;
  RT.render.stream();
  ok("L6b TRANSITION: turning anonymisation off changes the sentence — the claim is no longer made",
     !/the reviewer saw letters only/.test(reviewBody().textContent) &&
     /did not anonymise the review round/.test(reviewBody().textContent),
     "not-anonymised wording");
  ok("L6c and the system card above it agreed all along (both read the same flag)",
     /not anonymised/.test(stream.textContent), "system card agrees");
  RT.state.session.protocol.anonymize.review = true;
  RT.render.stream();
  ok("L6d TRANSITION back: turning it on restores the claim",
     /the reviewer saw letters only/.test(reviewBody().textContent), "restored");

  /* ==================================================================== L2
     System feedback off the status hues. */
  const flashOk = ruleOf(css, ".flash.ok");
  const hintBad = ruleOf(css, ".hint.bad");
  const flashErr = ruleOf(css, ".flash.err");
  doc.getElementById("flash").textContent = "";
  const copyBtn = stream.querySelectorAll("button").filter(b => String(b.dataset.k || "").indexOf("act|copy|") === 0)[0];
  copyBtn.click();
  await H.waitFor(() => doc.getElementById("flash").textContent.indexOf("Copied") >= 0, "clipboard flash");
  const okBox = doc.getElementById("flash").querySelector(".flash");
  ok("L2a TRANSITION: a clipboard copy raises an `ok` flash",
     okBox.className.indexOf("ok") >= 0 && /Copied/.test(okBox.textContent), okBox.className);
  ok("L2b-css and that `ok` flash wears neutral chrome — no status token anywhere in the rule",
     flashOk && flashOk.indexOf("--st-") < 0 && flashOk.indexOf("--tint-") < 0 &&
     /surface-3/.test(flashOk) && /var\(--text\)/.test(flashOk), flashOk);
  ok("L2c-css `err` keeps the status hue, because every flash that wears it is a call outcome",
     flashErr && /--st-error/.test(flashErr), flashErr);
  RT.act.newSessionView();
  RT.state.draft.mode = "persona";
  RT.state.draft.roles.bull = "gpt"; RT.state.draft.roles.bear = "gpt"; RT.state.draft.roles.risk = "glm";
  RT.state.draft.charters.bull = "B"; RT.state.draft.charters.bear = "E"; RT.state.draft.charters.risk = "R";
  RT.render.stream();
  const collide = stream.querySelectorAll("[data-k=createblock]")[0];
  ok("L2d TRANSITION: a bad line-up raises the validation hint on the form",
     !!collide && collide.className.indexOf("hint bad") >= 0 && /both bull and bear/.test(collide.textContent),
     collide.className);
  ok("L2e-css the validation hint is ink and weight, NOT the error status token",
     hintBad && hintBad.indexOf("--st-") < 0 && /var\(--text\)/.test(hintBad) && /font-weight/.test(hintBad),
     hintBad);
  ok("L2f-css the duplicate-role badge came off the status channel with it",
     (ruleOf(css, ".badge.bad") || "").indexOf("--st-") < 0, ruleOf(css, ".badge.bad"));

  /* ==================================================================== L1
     Checkbox accent on its own identity token, both themes. */
  const accentRule = ruleOf(css, 'input[type="checkbox"], input[type="radio"]');
  ok("L1a-css checkboxes and radios declare an accent-color (the file had none)",
     !!accentRule && /accent-color: var\(--accent\)/.test(accentRule), accentRule);
  const accents = THEMES.map(t => ({ name: t[0], accent: tokenIn(css, t[1], "accent") }));
  ok("L1b-css every theme defines --accent, so the accent is never the browser default",
     accents.every(a => !!a.accent), accents.map(a => a.name + " " + a.accent).join(" · "));
  ok("L1c-css the identity accent is separate from every status token in all four themes",
     THEMES.every(t => {
       const a = tokenIn(css, t[1], "accent");
       return ["st-queued", "st-working", "st-done", "st-error", "st-timeout", "st-cancel"]
         .every(n => tokenIn(css, t[1], n) !== a);
     }), "no theme reuses a status hex as --accent");
  RT.act.newSessionView();
  RT.render.stream();
  const toggle = stream.querySelectorAll("input").filter(i => i.type === "checkbox" && /stop_on_error$/.test(i.dataset.k || ""))[0];
  const stopBefore = RT.state.draft.protocol.stop_on_error;
  toggle.checked = !stopBefore;
  toggle.dispatchEvent({ type: "change", target: toggle });
  ok("L1d TRANSITION: a real checkbox the accent rule reaches actually drives the draft",
     RT.state.draft.protocol.stop_on_error === !stopBefore,
     "stop_on_error " + stopBefore + " -> " + RT.state.draft.protocol.stop_on_error);

  /* ==================================================================== L3
     A focus ring on the recipient input. */
  const pickerFocus = ruleOf(css, ".picker:focus-within");
  ok("L3a-css the picker takes a visible ring on focus-within (the input killed its own)",
     !!pickerFocus && /outline: 2px solid var\(--accent\)/.test(pickerFocus), pickerFocus);
  ok("L3b-css and the inner input still draws no ring of its own, so the chip row stays calm",
     /\.picker input:focus \{[^}]*outline: none/.test(css), ruleOf(css, ".picker input:focus"));
  const pickerInput = stream.querySelectorAll(".picker input")[0];
  ok("L3c TRANSITION: focusing the recipient input puts the focus inside the .picker box the ring is on",
     (pickerInput.focus(), doc.activeElement === pickerInput && !!pickerInput.closest(".picker")),
     "activeElement inside .picker = " + !!pickerInput.closest(".picker"));

  /* ==================================================================== C1
     Notes flushed on navigation; an unsaved decision draft survives it. */
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sidA, "A again");
  RT.render.info();
  const notesField = info.querySelectorAll("textarea").filter(t => t.dataset.k === "notes")[0];
  const lateSentence = "the cost that dominates is the one nobody puts on the sheet";
  typeAt(notesField, lateSentence);
  ok("C1a a notes save is pending and NOT yet on the record",
     !!RT.state.notesPending && RT.state.notesPending.sid === sidA &&
     ((await apiGet("/api/session/" + sidA)).notes || "") !== lateSentence,
     "pending for " + String(RT.state.notesPending.sid).slice(0, 8));
  const sessions = await apiGet("/api/sessions");
  const other = sessions.filter(s => s.id !== sidA)[0].id;
  await RT.act.selectSession(other);              /* inside the 900 ms window */
  await H.waitFor(() => RT.state.sid === other, "moved");
  ok("C1b TRANSITION: switching sessions SENT what the debounce was holding, to the old session",
     await (async () => { await until(async () => ((await apiGet("/api/session/" + sidA)).notes || "") === lateSentence,
                                      "notes flushed"); return true; })(),
     "notes present on " + String(sidA).slice(0, 8) + " after the switch");
  ok("C1c and nothing was written to the session the reader moved to",
     ((await apiGet("/api/session/" + other)).notes || "") !== lateSentence,
     "target session clean");
  ok("C1d the pending marker is cleared, so a second switch cannot double-send",
     RT.state.notesPending === null && RT.state.notesTimer === 0,
     "pending=" + RT.state.notesPending + " timer=" + RT.state.notesTimer);

  /* an unsaved decision draft: parked on the way out, restored on the way back,
     and never POSTed behind the reader's back */
  const personaId = await (async () => {
    const r = await fetch(H.BASE + "/api/session/new", {
      method: "POST", headers: { "X-Roundtable": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "round5 decision draft", mode: "persona", members: {
        gpt: { tier: "luna", role: "bull", charter: "up" },
        kimi: { tier: "k3", role: "bear", charter: "down" },
        glm: { tier: "high", role: "risk", charter: "risk" } } })
    });
    return (await r.json()).id;
  })();
  await RT.act.loadSessions();
  await RT.act.selectSession(personaId);
  await H.waitFor(() => RT.state.session && RT.state.session.id === personaId, "persona session");
  RT.render.info();
  const ratField = info.querySelectorAll("textarea").filter(t => t.dataset.k === "decision-rationale")[0];
  const halfWritten = "two seats agreeing is not evidence; the risk seat is the only one who";
  typeAt(ratField, halfWritten);
  const decisionPostsBefore = ctx.calls.filter(c => c.url === "/api/decision").length;
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.sid === sidA, "away");
  ok("C1e TRANSITION: navigating away from an unsaved DECISION posts nothing (it is the human's verdict)",
     ctx.calls.filter(c => c.url === "/api/decision").length === decisionPostsBefore &&
     ((await apiGet("/api/session/" + personaId)).decision || {}).rationale !== halfWritten,
     "0 decision writes");
  await RT.act.selectSession(personaId);
  await H.waitFor(() => RT.state.session && RT.state.session.id === personaId, "back to persona");
  RT.render.info();
  const ratBack = info.querySelectorAll("textarea").filter(t => t.dataset.k === "decision-rationale")[0];
  ok("C1f TRANSITION: coming back restores the half-written decision, still marked unsaved",
     ratBack.value === halfWritten && RT.util.fieldDirty("decision-rationale") === true,
     JSON.stringify(ratBack.value.slice(0, 30)) + " dirty=" + RT.util.fieldDirty("decision-rationale"));
  ok("C1g the parked draft did not leak into the OTHER session's field cache",
     Object.keys(RT.util.fields()).every(k => k.indexOf(personaId + "|") === 0 || k.indexOf("draft|") === 0),
     Object.keys(RT.util.fields()).filter(k => k.indexOf("draft|") !== 0).length + " session-scoped nodes");

  /* ==================================================================== C2
     Relay completion re-guards: the shared composer belongs to whatever
     session is open when the request lands, not to the one that sent it. */
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sidA, "A for the relay");
  RT.state.delivery = "relay";
  RT.state.turns = 1;
  const two = RT.util.answeredSeats(0).slice(0, 2);
  RT.act.setComposer("@" + two[0] + " @" + two[1] + " which cost line survives the first bad month?");
  const relayRunning = RT.act.runRelayFromComposer();          /* in flight */
  await RT.act.selectSession(other);                           /* the reader moves */
  const typedAfter = "a completely different question, half typed";
  RT.act.setComposer(typedAfter);
  const relayResult = await relayRunning;
  ok("C2a TRANSITION: the relay finished on a session that is no longer open and did NOT clear the composer",
     doc.getElementById("msg").value === typedAfter && relayResult !== true,
     JSON.stringify(doc.getElementById("msg").value.slice(0, 30)) + " result=" + String(relayResult));
  ok("C2b the relay really did run, on the session it was addressed to",
     await (async () => {
       await until(async () => ((await apiGet("/api/session/" + sidA)).rounds[0].relays || []).length >= 2, "second relay");
       return true;
     })(), "relay landed on " + String(sidA).slice(0, 8));
  /* the same-session half: text typed AFTER the send is not the draft that was
     sent, so it is not the page's to delete */
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sidA, "A again for C2c");
  await until(async () => !RT.util.narrow() && !((RT.state.session.rounds[0].relays || []).some(r => r.status === "running")), "relays settled");
  await RT.act.refetch(sidA, RT.state.gen);
  RT.state.delivery = "relay"; RT.state.turns = 1;
  RT.act.setComposer("@" + two[0] + " @" + two[1] + " and which one is a fixed cost dressed as variable?");
  const running2 = RT.act.runRelayFromComposer();
  RT.act.setComposer("typed while the relay was still out");
  const result2 = await running2;
  ok("C2c TRANSITION: same session, but the box no longer holds the text that was sent — it is left alone",
     doc.getElementById("msg").value === "typed while the relay was still out" && result2 === true,
     JSON.stringify(doc.getElementById("msg").value.slice(0, 30)));
  ok("C2d the page says so rather than silently keeping it",
     /still here, unsent/.test(doc.getElementById("deliveryNote").textContent),
     doc.getElementById("deliveryNote").textContent);
  /* and the ordinary path still clears, so the fix did not break the common case */
  await until(async () => !((await apiGet("/api/session/" + sidA)).rounds[0].relays || []).some(r => r.status === "running"), "settled");
  await RT.act.refetch(sidA, RT.state.gen);
  RT.state.delivery = "relay"; RT.state.turns = 1;
  RT.act.setComposer("@" + two[0] + " @" + two[1] + " last one: name the cost line");
  const result3 = await RT.act.runRelayFromComposer();
  ok("C2e TRANSITION: untouched composer, same session — the successful relay still empties it",
     result3 === true && doc.getElementById("msg").value === "",
     "cleared=" + (doc.getElementById("msg").value === ""));

  /* ==================================================================== C3
     Same-session response ordering. Two overlapping GETs, resolved in reverse
     order; the older snapshot must not repaint over the newer one. */
  await until(async () => !((await apiGet("/api/session/" + sidA)).rounds[0].relays || []).some(r => r.status === "running"), "quiet");
  await RT.act.refetch(sidA, RT.state.gen);
  const fullRounds = RT.state.session.rounds.length;
  const fullRelays = RT.state.session.rounds[0].relays.length;
  const realFetch = ctx.sandbox.fetch;
  let staleArmed = true;
  ctx.sandbox.fetch = async function (path, opts) {
    if (staleArmed && String(path).indexOf("/api/session/") === 0) {
      staleArmed = false;
      const res = await realFetch(path, opts);
      const text = await res.text();
      const snap = JSON.parse(text);
      snap.rounds[0].relays = [];                  /* a demonstrably OLDER world */
      snap.notes = "STALE SNAPSHOT";
      await H.sleep(500);                          /* and it comes back last */
      return { ok: true, status: 200, text: async () => JSON.stringify(snap) };
    }
    return await realFetch(path, opts);
  };
  const older = RT.act.refetch(sidA, RT.state.gen);   /* ticket 1, resolves second */
  await H.sleep(40);
  const newer = RT.act.refetch(sidA, RT.state.gen);   /* ticket 2, resolves first */
  const newerSnap = await newer;
  ok("C3a TRANSITION: the newer response landed first and painted the current world",
     !!newerSnap && RT.state.session.rounds[0].relays.length === fullRelays &&
     RT.state.session.notes !== "STALE SNAPSHOT",
     fullRelays + " relays on screen");
  const olderSnap = await older;
  ctx.sandbox.fetch = realFetch;
  ok("C3b TRANSITION: the older response then arrived and was DROPPED, not painted",
     olderSnap === null && RT.state.session.rounds[0].relays.length === fullRelays &&
     RT.state.session.rounds.length === fullRounds && RT.state.session.notes !== "STALE SNAPSHOT",
     "still " + RT.state.session.rounds[0].relays.length + " relays, notes intact");
  ok("C3c the ordering is per-session: switching resets it, so the next session starts clean",
     await (async () => {
       await RT.act.selectSession(other);
       await H.waitFor(() => RT.state.sid === other, "other");
       const appliedAfterSwitch = RT.state.fetchApplied;
       await RT.act.selectSession(sidA);
       await H.waitFor(() => RT.state.sid === sidA, "A");
       return appliedAfterSwitch > 0 && RT.state.fetchApplied > 0;
     })(), "fetchApplied re-based on each switch");

  /* ==================================================================== T1
     The idle composer. The creed is printed once and the delivery explanation
     is a title, not a permanent row. */
  const composerHtml = /<div id="composer">[\s\S]*?<\/main>/.exec(bodyHtml)[0];
  ok("T1a the composer no longer prints a second copy of the creed",
     composerHtml.indexOf('class="creed"') < 0 &&
     (composerHtml.match(/A roundtable session is a debate record/g) || []).length === 0 &&
     css.indexOf(".creed {") < 0,
     "0 copies in the composer markup, and the .creed rule is gone with it");
  RT.render.info();
  ok("T1b it is still on the page exactly once, in the info pane where the brief groups it",
     (info.textContent.match(/A roundtable session is a debate record, not a review\./g) || []).length === 1,
     "1 copy in the info pane");
  RT.state.delivery = "independent";
  RT.act.setComposer("");
  ok("T1c TRANSITION: idle and unblocked, the explanation row is empty and lives on the control's title",
     doc.getElementById("deliveryNote").textContent === "" &&
     /blind and in parallel/.test(doc.getElementById("delivery").title),
     "note=" + JSON.stringify(doc.getElementById("deliveryNote").textContent) +
     " title=" + JSON.stringify(doc.getElementById("delivery").title.slice(0, 30)));
  RT.act.setComposer("@" + two[0] + " one seat only");
  RT.state.delivery = "relay";
  RT.render.composer();
  ok("T1d TRANSITION: a real blocker still takes the row — the line is earned, not permanent",
     /at least two seats/.test(doc.getElementById("deliveryNote").textContent),
     doc.getElementById("deliveryNote").textContent);
  RT.state.delivery = "independent"; RT.act.setComposer("");
  ok("T1e TRANSITION: clearing the blocker gives the row back",
     doc.getElementById("deliveryNote").textContent === "", "row empty again");
  ok("T1f Context stays expandable, not flattened away",
     bodyHtml.indexOf('<details id="ctxBox">') >= 0 && !!doc.getElementById("ctx"),
     "ctxBox present");

  /* ==================================================================== T2
     Actionable metadata: >= 13px and one step darker than decorative. */
  const sizeOf = rule => { const m = /font-size:\s*([\d.]+)px/.exec(rule || ""); return m ? Number(m[1]) : null; };
  /* Include explicitly declared responsive sizes. Looking only at the first
     base rule would miss a smaller mobile override and produce a false green. */
  const minimumSize = selector => {
    const sizes = [];
    const rules = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    while ((match = rules.exec(css))) {
      if (!match[1].includes(selector)) continue;
      const size = sizeOf(match[2]);
      if (size != null) sizes.push(size);
    }
    return sizes.length ? Math.min(...sizes) : null;
  };
  const miniSize = minimumSize("button.mini");
  const sactSize = minimumSize(".sacts button");
  const segSize = minimumSize(".seg button");
  const hintSize = sizeOf(ruleOf(css, ".hint"));
  const badgeSize = sizeOf(ruleOf(css, ".badge"));
  ok("T2a-css every actionable metadata control is at least 13px",
     miniSize >= 13 && sactSize >= 13 && segSize >= 13,
     "mini " + miniSize + " · sidebar actions " + sactSize + " · segmented " + segSize);
  ok("T2b-css decorative metadata stayed small, so the two are still distinguishable",
     hintSize <= 12 && badgeSize <= 12, "hint " + hintSize + " · badge " + badgeSize);
  ok("T2c-css actionable metadata is one step darker: --text against the decorative --muted",
     /color: var\(--text\)/.test(ruleOf(css, "button.quiet") || "") &&
     /color: var\(--muted\)/.test(ruleOf(css, ".hint") || "") &&
     /color: var\(--muted\)/.test(ruleOf(css, ".badge") || ""),
     "quiet=" + (/var\(--text\)/.test(ruleOf(css, "button.quiet") || "") ? "--text" : "?"));
  ok("T2d-css the sidebar row actions are readable without hover (the .35 ghost is gone)",
     /opacity: 1/.test(ruleOf(css, ".sacts button") || "") &&
     !/opacity: \.35/.test(ruleOf(css, ".sacts button") || "") &&
     /background: var\(--surface-3\)/.test(ruleOf(css, ".srow-wrap:hover .sacts button, .srow-wrap:focus-within .sacts button") || ""),
     ruleOf(css, ".sacts button"));
  RT.render.sidebar();
  const sideActs = doc.getElementById("sidebar").querySelectorAll(".sacts button");
  ok("T2e TRANSITION: the sidebar's row actions are on the page and act without a hover first",
     sideActs.length >= 2 && sideActs.every(b => b.className.indexOf("mini") >= 0) &&
     (() => {
       const pin = sideActs.filter(b => /Pin|Unpin/.test(b.textContent))[0];
       const before = pin.textContent;
       pin.click();
       const after = doc.getElementById("sidebar").querySelectorAll(".sacts button")
         .filter(b => /Pin|Unpin/.test(b.textContent))[0].textContent;
       return before !== after;
     })(),
     sideActs.length + " row-action buttons, pin toggled without hover");

  /* ==================================================================== T3
     Round boundaries get more air than message boundaries. */
  const roundMargin = /margin:\s*(\d+)px 0 (\d+)px/.exec(ruleOf(css, ".rounddiv") || "");
  /* Chamber amendment (2026-09-07): cards meet across a margin, not across two paddings and a rule. */
  const msgPad = /margin:\s*\d+(?:px)? \d+(?:px)? (\d+)px/.exec(ruleOf(css, ".msg") || "");
  const roundGap = roundMargin ? Number(roundMargin[1]) : null;
  const msgGap = msgPad ? Number(msgPad[1]) : null;
  ok("T3a-css the round boundary is worth more vertical space than a message boundary",
     roundGap != null && msgGap != null && roundGap > msgGap * 2,
     "round " + roundGap + "px above the divider vs " + msgGap + "px between messages");
  await RT.act.selectSession(sidA);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sidA, "A for T3");
  RT.act.setComposer("A second question, so the transcript has two round boundaries.");
  RT.state.delivery = "independent";
  await RT.act.sendComposer();
  await H.waitFor(() => (RT.state.session.rounds || []).length === 2, "second round");
  RT.render.stream();
  ok("T3b TRANSITION: a second round puts a real round divider between the two, above the message rules",
     stream.querySelectorAll(".rounddiv").length === 2 &&
     stream.querySelectorAll(".rounddiv .rlabel").filter(n => n.textContent === "Round 2").length === 1,
     stream.querySelectorAll(".rounddiv").length + " round dividers");

  /* ---------------------------------------------------------- token intact */
  ok("Z1 the token line the server rewrites is byte-for-byte intact",
     /const API_TOKEN = "__ROUNDTABLE_TOKEN__";/.test(H.readUI()),
     "placeholder preserved on disk");
  ok("Z2 every request the page made carried the header",
     ctx.calls.every(c => c.headers["X-Roundtable"] === TOKEN) &&
     ctx.calls.filter(c => c.method === "POST").every(c => c.headers["Content-Type"] === "application/json"),
     ctx.calls.length + " requests, all headed");

  console.log("");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS") + "  (" + pass + " passed, " + fail + " failed)");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL  suite crashed: " + e.stack); process.exit(1); });
