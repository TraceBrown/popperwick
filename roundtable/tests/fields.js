/* Fix-round checks: unsaved-draft survival, derived seats, honest trims,
   the persona pre-check, and the compare-view column property. */
"use strict";
const H = require("./harness.js");
let pass = 0, fail = 0;
function ok(l, c, d) { if (c) { pass++; console.log("PASS  " + l + (d ? "  [" + d + "]" : "")); } else { fail++; console.log("FAIL  " + l + (d ? "  [" + d + "]" : "")); } }
function typeInto(node, text) {                    /* what a human does, in DOM terms */
  node.focus();
  node.value = text;
  node.dispatchEvent({ type: "input", target: node });
}

(async () => {
  const served = await H.loadServedPage();
  const TOKEN = /const API_TOKEN = "([^"]+)"/.exec(served.html)[1];
  const ctx = H.makeContext(served.html, () => {});
  const doc = ctx.doc, RT = ctx.sandbox.RT;
  await RT.boot();
  await H.waitFor(() => RT.state.config, "config");

  /* a real session to type into */
  RT.act.newSessionView();
  RT.act.setComposer("Which cost dominates?");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.sid, "sid");
  await H.waitFor(() => Object.keys((((RT.state.session || {}).rounds || [])[0] || {}).stage1 || {}).length === 3, "answers");
  const sid = RT.state.sid;

  /* ---- item 1: notes ---------------------------------------------------- */
  const notes1 = doc.querySelector('[data-k="notes"]');
  typeInto(notes1, "half a sentence the human is still writ");
  RT.render.info();
  const notes2 = doc.querySelector('[data-k="notes"]');
  ok("F1 render.info does not rebuild the Notes node", notes1 === notes2, notes1 === notes2 ? "same node" : "REPLACED");
  ok("F2 the unsaved Notes text survives the re-render",
     notes2.value === "half a sentence the human is still writ", JSON.stringify(notes2.value));

  /* a seat event arriving mid-sentence: the real path, refetch + full render */
  typeInto(notes2, "half a sentence the human is still writing");
  await RT.act.refetch(sid, RT.state.gen);
  const notes3 = doc.querySelector('[data-k="notes"]');
  ok("F3 a refetch mid-sentence keeps the draft and the node",
     notes3 === notes1 && notes3.value === "half a sentence the human is still writing", JSON.stringify(notes3.value));
  ok("F4 the pane says the draft is unsaved", doc.getElementById("info").textContent.indexOf("unsaved") >= 0);

  /* the debounced save lands, the field goes clean, the record then flows in */
  await H.sleep(1400);
  const saved = await (await fetch(H.BASE + "/api/session/" + sid, { headers: { "X-Roundtable": TOKEN } })).json();
  ok("F5 the draft is what actually reached the server",
     saved.notes === "half a sentence the human is still writing", JSON.stringify(saved.notes));
  ok("F6 the field is clean once saved", RT.util.fieldDirty("notes") === false);

  /* ---- item 1: decision fields ----------------------------------------- */
  RT.act.newSessionView();
  const d = RT.state.draft;
  d.mode = "persona";
  d.roles.bull = "gpt"; d.roles.bear = "kimi"; d.roles.risk = "glm";

  /* ---- item 7: the persona pre-check, BEFORE any request ---------------- */
  const newBefore = ctx.calls.filter(c => c.url === "/api/session/new").length;
  const problem1 = await RT.act.createSession("");
  ok("F7 an empty charter is named by role, client-side",
     problem1 === null && /charter/.test(doc.getElementById("flash").textContent) &&
     /bull/.test(doc.getElementById("flash").textContent),
     doc.getElementById("flash").textContent.replace("Dismiss", "").trim());
  ok("F8 the bad persona line-up never reaches the server",
     ctx.calls.filter(c => c.url === "/api/session/new").length === newBefore, "0 new requests");
  d.charters.bull = "Bull."; d.charters.bear = "Bear."; d.charters.risk = "Risk.";
  d.roles.bear = "gpt";
  await RT.act.createSession("");
  ok("F9 one seat holding two roles is named, client-side",
     /is both bull and bear/.test(doc.getElementById("flash").textContent),
     doc.getElementById("flash").textContent.replace("Dismiss", "").trim());
  d.roles.bear = "";
  ok("F10 an unassigned role is named", /no seat is assigned bear/.test(RT.act.personaProblemDraft(d) || ""),
     RT.act.personaProblemDraft(d));
  d.roles.bear = "kimi";
  RT.act.setComposer("Second data feed?");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.session && RT.state.session.mode === "persona", "persona session");
  await H.waitFor(() => Object.keys(RT.state.session.rounds[0].stage1).length === 3, "briefs");
  RT.render.info();
  const rat1 = doc.querySelector('[data-k="decision-rationale"]');
  typeInto(rat1, "Two seats agreeing is not evidence.");
  const dis1 = doc.querySelector('[data-k="decision-dissent"]');
  typeInto(dis1, "The bear seat's fill assumption is unchecked.");
  const st1 = doc.querySelector('[data-k="decision-stance"]');
  st1.value = "reject"; st1.dispatchEvent({ type: "change", target: st1 });
  await RT.act.refetch(RT.state.sid, RT.state.gen);
  const rat2 = doc.querySelector('[data-k="decision-rationale"]');
  ok("F11 the decision draft survives a refetch, same nodes",
     rat2 === rat1 && rat2.value === "Two seats agreeing is not evidence." &&
     doc.querySelector('[data-k="decision-dissent"]').value === "The bear seat's fill assumption is unchecked." &&
     doc.querySelector('[data-k="decision-stance"]').value === "reject");
  await RT.act.saveDecision(st1.value, rat1.value, dis1.value);
  ok("F12 the saved decision clears the dirty flags",
     RT.util.fieldDirty("decision-rationale") === false && RT.util.fieldDirty("decision-stance") === false);

  /* ---- drafts belong to their own session ------------------------------ */
  await RT.act.selectSession(sid);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sid, "back");
  ok("F13 switching sessions forgets the other session's drafts (draft fields are global by design)",
     doc.querySelector('[data-k="notes"]').value === "half a sentence the human is still writing" &&
     Object.keys(RT.util.fields()).every(k => k.indexOf(sid + "|") === 0 || k.indexOf("draft|") === 0),
     Object.keys(RT.util.fields()).filter(k => k.indexOf("draft|") !== 0).join(" "));

  /* ---- item 2: compare columns ----------------------------------------- */
  RT.state.compare.add(0); RT.render.stream();
  const grid = doc.getElementById("stream").querySelector(".compare");
  ok("F14 the compare grid sets --cols, not an inline grid-template-columns",
     grid.style["--cols"] === "3" && !grid.style.gridTemplateColumns,
     "--cols=" + grid.style["--cols"] + " inline grid-template-columns=" + grid.style.gridTemplateColumns);
  const css = /<style>([\s\S]*?)<\/style>/.exec(served.html)[1];
  ok("F15 the ≤900px rule can now win",
     /\.compare \{[^}]*repeat\(var\(--cols, 3\)/.test(css) &&
     /@media \(max-width: 900px\) \{ \.compare \{ grid-template-columns: minmax\(0, 1fr\); \} \}/.test(css));
  RT.state.compare.delete(0); RT.render.stream();

  /* ---- item 3: seats are derived ---------------------------------------- */
  ok("F16 addressable seats come from the session's members",
     RT.util.addressableSeats().join(",") === Object.keys(RT.state.session.members).join(","),
     RT.util.addressableSeats().join(","));
  ok("F17 an unknown seat name is not addressable", RT.util.mentionsIn("@gpt @nope @glm").join(",") === "gpt,glm");
  RT.act.newSessionView();
  RT.state.draft.members.glm.on = false;              /* a two-seat session */
  RT.act.setComposer("Two seats only.");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.session && Object.keys(RT.state.session.members).length === 2, "two-seat session");
  ok("F18 a seat absent from the session is not addressable in it",
     RT.util.addressableSeats().join(",") === "gpt,kimi" && RT.util.mentionsIn("@gpt @glm").join(",") === "gpt",
     RT.util.addressableSeats().join(","));
  ok("F19 the composer placeholder names the session's own seats",
     doc.getElementById("msg").placeholder.indexOf("@gpt @kimi") > 0 &&
     doc.getElementById("msg").placeholder.indexOf("@glm") < 0,
     JSON.stringify(doc.getElementById("msg").placeholder.slice(-40)));
  ok("F20 hardcoded trio is gone from the source", served.html.indexOf("SEAT_ORDER") < 0);

  /* ---- item 6: no silent cuts ------------------------------------------ */
  const long = "x".repeat(5000);
  const draft = RT.act.seedRelay(0, long, "a long answer");
  ok("F21 an over-cap relay seed reports the trim",
     draft.prompt.length === 4000 && draft.trimmed && draft.trimmed.total === 5000,
     JSON.stringify(draft.trimmed));
  RT.render.stream();
  ok("F22 the trim notice is visible on the field",
     doc.getElementById("stream").textContent.indexOf("trimmed to 4000 of 5000") >= 0);
  const short = RT.act.seedRelay(0, "y".repeat(900), "a normal answer");
  ok("F23 a normal-length seed is taken whole and flagged as untrimmed",
     short.prompt.length === 900 && short.trimmed === null);
  /* F24 (rewritten 2026-09-07, reply chip): on a page with the reply chip,
     Quote no longer pastes into the textarea, so the old letter — no
     `split("\n").slice(0, 40)` on the paste path — inspects a path that is
     gone there. Same spirit, new path: the chip's RECORD is every line of the
     answer, and the textarea is not written to. A page WITHOUT the chip (B, D)
     keeps the old letter, so this shared suite still runs against either. */
  if (RT.act.setQuote && doc.getElementById("quoteRow")) {
    await H.waitFor(() => ["gpt", "kimi"].every(s => (((((RT.state.session || {}).rounds || [])[0] || {}).stage1 || {})[s] || {}).status === "done"), "two answers");
    const f24Text = "\n\nFIRST LINE OF THE ANSWER\n" + Array.from({ length: 60 }, (_, i) => "line " + (i + 2) + " " + "w".repeat(20)).join("\n");
    RT.state.session.rounds[0].stage1.gpt.text = f24Text;
    RT.render.stream();
    RT.act.setComposer("typed before quoting");
    const f24Btn = doc.getElementById("stream").querySelectorAll(".acts button").filter(b => b.dataset.k === "act|quote|pk|s1|0|gpt")[0];
    f24Btn.click();
    ok("F24 Quote keeps every line — the chip's record is the whole answer, the textarea untouched",
       !!RT.state.quote && RT.state.quote.text === f24Text && RT.state.quote.text.split("\n").length > 40 &&
       doc.getElementById("msg").value === "typed before quoting" &&
       doc.querySelector("#quoteRow .quote-line").textContent === "FIRST LINE OF THE ANSWER",
       RT.state.quote ? RT.state.quote.text.split("\n").length + " lines kept" : "no chip");
    RT.act.clearQuote(); RT.act.setComposer("");
  } else {
    ok("F24 Quote no longer drops lines past 40", served.html.indexOf('split("\\n").slice(0, 40)') < 0);
  }

  /* ---- item 4 --------------------------------------------------------- */
  ok("F25 the unparsed-ranking cell is muted, never the working hue",
     /td\.unparsed \{[^}]*color: var\(--muted\)/.test(css) && !/td\.unparsed \{[^}]*st-working/.test(css) &&
     !/td\.unparsed \{[^}]*italic/.test(css));

  /* ---- 2026-09-07: gpt tiers/efforts and the four-seat cap are server-published ---- */
  const cfg = RT.state.config;
  ok("F26 the config lists gpt tiers luna, sol, terra, astra in that order",
     Object.keys(cfg.seats.gpt.tiers).join(",") === "luna,sol,terra,astra" && cfg.seats.gpt.default_tier === "luna",
     Object.keys(cfg.seats.gpt.tiers).join(",") + " default " + cfg.seats.gpt.default_tier);
  const efforts = ((cfg.seats.gpt.knobs || {}).effort || {}).values || [];
  ok("F27 the gpt effort enum ends with max",
     efforts.join(",") === "low,medium,high,xhigh,max" && efforts[efforts.length - 1] === "max", efforts.join(","));
  ok("F28 the config publishes max_seats = 4", cfg.max_seats === 4, "max_seats=" + JSON.stringify(cfg.max_seats));
  /* a raw POST, built the way the page builds its own: token + origin headers, JSON body */
  const five = await fetch(H.BASE + "/api/session/new", {
    method: "POST",
    headers: { "X-Roundtable": TOKEN, "Content-Type": "application/json", "Origin": H.BASE },
    body: JSON.stringify({ mode: "roundtable", members: { gpt: {}, kimi: {}, glm: {}, gpt2: {}, kimi2: {} } })
  });
  const fiveData = await five.json().catch(() => null);
  ok("F29 five members are refused with a 400 naming members",
     five.status === 400 && (fiveData || {}).field === "members" && /at most four seats/.test((fiveData || {}).error || ""),
     "HTTP " + five.status + " " + JSON.stringify(fiveData));
  ok("F31 the config publishes the caps the page checks before a send, and the page reads them rather than mirroring",
     !!cfg.caps && cfg.caps.question === 20000 && cfg.caps.relay_prompt === 4000 &&
     /function questionCap\(\)/.test(served.html) && /function relayCap\(\)/.test(served.html) &&
     served.html.indexOf("const MAX_QUESTION") < 0 && served.html.indexOf("const MAX_RELAY_PROMPT") < 0,
     JSON.stringify(cfg.caps));
  /* the page needed no edit for the tiers to show: its tier <select> is built from the config */
  RT.act.newSessionView();
  const gptTier = doc.getElementById("stream").querySelectorAll("select").filter(n => /-tier-gpt$/.test(n.dataset.k || ""))[0];
  const tierOpts = gptTier ? gptTier.querySelectorAll("option").map(o => o.value) : [];
  ok("F30 the page's gpt tier picker offers the new tiers, with their notes, from the config alone",
     tierOpts.join(",") === "luna,sol,terra,astra" &&
     gptTier.querySelectorAll("option").every(o => o.textContent.indexOf(o.value + " — " + cfg.seats.gpt.tiers[o.value].note) === 0),
     tierOpts.join(","));

  console.log("\nRESULT: " + (fail === 0 ? "PASS" : "FAIL") + "  (" + pass + " passed, " + fail + " failed)");
  ctx.streams.forEach(s => s.close());
  if (RT.state.tickTimer) clearInterval(RT.state.tickTimer);
  if (RT.state.notesTimer) clearTimeout(RT.state.notesTimer);
  if (RT.state.refetchTimer) clearTimeout(RT.state.refetchTimer);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("HARNESS ERROR: " + e.stack); process.exit(2); });
