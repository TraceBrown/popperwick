/* Reading continuity: real page/API paths, deterministic pending-request gates.
   Geometry assertions are a fallback check; real browser measurements are in HANDBACK.md. */
"use strict";
const H = require("./harness.js");
let pass = 0, fail = 0;
function ok(label, condition) { console.log((condition ? "PASS  " : "FAIL  ") + label); condition ? pass++ : fail++; }
function type(node, text) { node.value = text; node.dispatchEvent({ type: "input", target: node }); }
function gate(ctx, path, reject) {
  const original = ctx.sandbox.fetch;
  let enter, release;
  const entered = new Promise(r => { enter = r; });
  const waiting = new Promise(r => { release = r; });
  ctx.sandbox.fetch = async (url, opts) => {
    if (url === path && opts && opts.method === "POST") {
      ctx.sandbox.fetch = original;
      enter(JSON.parse(opts.body)); await waiting;
      if (reject) return { ok: false, status: 409, text: async () => JSON.stringify({ error: "test refusal" }) };
    }
    return original(url, opts);
  };
  return { entered, release };
}
(async () => {
  const served = await H.loadServedPage();
  const ctx = H.makeContext(served.html, () => {});
  const RT = ctx.sandbox.RT, doc = ctx.doc;
  const msg = doc.getElementById("msg"), context = doc.getElementById("ctx"), stream = doc.getElementById("stream");
  await RT.boot();
  RT.act.setPane("info", true);
  ctx.fireResize(380); await H.sleep(180);
  ctx.fireResize(1280); await H.sleep(180);
  ok("R1 explicit Info-open choice survives resizing", doc.getElementById("app").dataset.info === "on");
  RT.act.newSessionView();
  const a = await RT.act.createSession("");
  RT.act.newSessionView();
  const b = await RT.act.createSession("");
  await RT.act.selectSession(a);
  type(msg, "A unsent"); type(context, "A context");
  doc.getElementById("ctxBox").open = true;
  RT.state.delivery = "relay"; RT.state.turns = 3;
  RT.state.compare.add(0); RT.state.open.add("review-options|0");
  RT.state.relay[0] = { order: ["gpt", "kimi"], turns: 2, prompt: "A relay draft", open: true };
  RT.state.reviewers[0] = { glm: false };
  stream.scrollHeight = 4000; stream.clientHeight = 600; stream.scrollTop = 980;
  await RT.act.selectSession(b);
  ok("R2 a different session starts with its own blank composer and context", msg.value === "" && context.value === "" && RT.state.delivery === "independent");
  type(msg, "B unsent"); type(context, "B context");
  await RT.act.selectSession(a);
  ok("R3 question, context, disclosure, delivery and turns restore together", msg.value === "A unsent" && context.value === "A context" && doc.getElementById("ctxBox").open && RT.state.delivery === "relay" && RT.state.turns === 3);
  ok("R4 comparison, review options, reviewers and relay drafts belong to A", RT.state.compare.has(0) && RT.state.open.has("review-options|0") && RT.state.reviewers[0].glm === false && RT.state.relay[0].prompt === "A relay draft");
  ok("R5 loading renders do not consume the saved reading position", stream.scrollTop === 980);
  await RT.act.selectSession(b);
  ok("R6 B draft survived A and inherited no transcript controls", msg.value === "B unsent" && context.value === "B context" && !RT.state.compare.size && !RT.state.open.size && !RT.state.relay[0]);
  RT.act.newSessionView();
  ok("R7 New does not inherit an existing session's writing", msg.value === "" && context.value === "");
  type(msg, "New unsent"); type(context, "New context");
  await RT.act.selectSession(a); RT.act.newSessionView();
  ok("R8 New has its own recoverable opening draft", msg.value === "New unsent" && context.value === "New context");

  type(msg, "Opening question"); type(context, "Opening context");
  let pending = gate(ctx, "/api/session/new");
  let task = RT.act.sendComposer(); await pending.entered;
  type(msg, "Later thought"); type(context, "Later context");
  pending.release(); await task;
  const created = RT.state.sid;
  ok("R9 creation sends the captured opening packet", RT.state.session.rounds[0].question === "Opening question" && RT.state.session.rounds[0].context === "Opening context");
  ok("R10 creation transfers newer typing intact", msg.value === "Later thought" && context.value === "Later context");
  RT.act.newSessionView();
  ok("R11 creation moves the New draft without leaving a stale duplicate", msg.value === "" && context.value === "");
  await RT.act.selectSession(created);
  await H.waitFor(() => Object.keys(RT.state.session.rounds[0].stage1).length === 3, "opening answers");
  type(msg, "Submitted question"); type(context, "Submitted context");
  pending = gate(ctx, "/api/round"); task = RT.act.sendComposer(); await pending.entered;
  type(msg, "Edited while pending"); type(context, "Changed context");
  pending.release(); await task;
  ok("R12 an accepted round preserves text and context typed while pending", msg.value === "Edited while pending" && context.value === "Changed context");
  await H.waitFor(() => Object.keys(RT.state.session.rounds[1].stage1).length === 3, "second answers");
  type(msg, "Same words");
  pending = gate(ctx, "/api/round"); task = RT.act.sendComposer(); await pending.entered;
  type(msg, "Edit"); type(msg, "Same words");
  pending.release(); await task;
  ok("R13 revisions preserve intentional retyping of the same words", msg.value === "Same words");
  await H.waitFor(() => Object.keys(RT.state.session.rounds[2].stage1).length === 3, "third answers");
  type(msg, "Send before navigation");
  pending = gate(ctx, "/api/round"); task = RT.act.sendComposer(); await pending.entered;
  await RT.act.selectSession(b); await RT.act.selectSession(created);
  pending.release(); await task;
  ok("R14 leaving and returning does not make an old generation current", msg.value === "Send before navigation");

  RT.act.newSessionView(); type(msg, "Recover on refusal"); type(context, "Recover context");
  pending = gate(ctx, "/api/round", true); task = RT.act.sendComposer(); await pending.entered;
  pending.release(); await task;
  const retryId = RT.state.sid;
  ok("R15 a refused opening round remains recoverable on the created session", !!retryId && msg.value === "Recover on refusal" && context.value === "Recover context" && RT.state.session.rounds.length === 0);
  await RT.act.sendComposer();
  ok("R16 retry sends on that session and clears only its accepted question", RT.state.sid === retryId && msg.value === "" && context.value === "Recover context");

  RT.act.newSessionView(); type(msg, "Keep for after empty create");
  const emptyId = await RT.act.createSession("");
  ok("R17 Create without an opening question preserves unrelated writing", RT.state.sid === emptyId && RT.state.session.rounds.length === 0 && msg.value === "Keep for after empty create");

  RT.act.newSessionView(); type(msg, "Background opening"); type(context, "Background packet");
  pending = gate(ctx, "/api/session/new"); task = RT.act.createSession(); await pending.entered;
  await RT.act.selectSession(b); type(msg, "B stays here"); type(context, "B private context");
  pending.release(); const backgroundId = await task;
  ok("R18 a late creation cannot take over B's composer", RT.state.sid === b && msg.value === "B stays here" && context.value === "B private context");
  await RT.act.selectSession(backgroundId);
  ok("R19 the late opening reaches its intended session", RT.state.session.rounds[0].question === "Background opening" && RT.state.session.rounds[0].context === "Background packet" && msg.value === "");

  RT.state.session.mode = "persona"; RT.state.delivery = "persona";
  await RT.act.selectSession(b);
  const originalFetch = ctx.sandbox.fetch;
  ctx.sandbox.fetch = async (url, opts) => {
    const res = await originalFetch(url, opts);
    if (url === "/api/session/" + backgroundId) { const data = JSON.parse(await res.text()); data.mode = "persona"; return { ok: true, text: async () => JSON.stringify(data) }; }
    return res;
  };
  await RT.act.selectSession(backgroundId);
  ok("R20 the loading placeholder does not normalize a restored Persona delivery", RT.state.delivery === "persona");
  ctx.sandbox.fetch = originalFetch;
  const code = RT.md.renderMd("```\n" + "wide evidence ".repeat(30) + "\n```");
  ok("R21 wide fenced evidence is keyboard focusable and untruncated", code.includes('tabindex="0"') && code.includes("wide evidence ".repeat(30)));
  ok("R22 model HTML remains inert in code blocks", RT.md.renderMd("```\n<script>alert(1)</script>\n```").includes("&lt;script&gt;"));
  await RT.act.selectSession(created);
  await H.waitFor(() => Object.keys(RT.state.session.rounds[3].stage1).length === 3, "fourth answers");
  RT.state.delivery = "relay"; type(msg, "@gpt @kimi Which assumption survives?");
  pending = gate(ctx, "/api/relay"); task = RT.act.sendComposer(); await pending.entered;
  await RT.act.selectSession(b); type(msg, "B while relay waits");
  pending.release(); await task;
  ok("R23 an accepted relay leaves the selected session's writing alone", RT.state.sid === b && msg.value === "B while relay waits");
  await RT.act.selectSession(created);
  ok("R24 accepted relay clears its unchanged parked composer", msg.value === "");
  await H.waitFor(() => (RT.state.session.rounds[3].relays || []).some(r => r.status === "done"), "relay completes");
  const gptTurns = RT.state.session.rounds[3].relays[0].entries.filter(e => e.seat === "gpt");
  gptTurns[gptTurns.length - 1].status = "cancelled";
  RT.render.info();
  ok("R25 the compact roster shows the latest cancelled seat", doc.getElementById("readingStatus").textContent.includes("Cancelled"));
  RT.render.stream();
  const toggle = doc.querySelector('[data-k="review-options-toggle|3"]');
  const disclosure = toggle.parentNode;
  ok("R26 review options start closed without hiding answered text", !disclosure.open && stream.textContent.includes("Position (FAKE FIXTURE)"));
  disclosure.open = true; disclosure.dispatchEvent({ type: "toggle", target: disclosure }); toggle.focus();
  RT.render.stream();
  ok("R27 incoming renders preserve review disclosure and its keyboard focus", doc.querySelector('[data-k="review-options-toggle|3"]').parentNode.open && doc.activeElement.dataset.k === "review-options-toggle|3");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS") + "  (" + pass + " passed, " + fail + " failed)");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL  suite crashed: " + e.stack); process.exit(1); });
