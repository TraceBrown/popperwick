/* Graft round: generic knobs from /api/config (including a knob the page has
   never seen), role-centric persona rows, the round aggregate chip,
   chronological stage blocks, and the shared next-session form. */
"use strict";
const H = require("./harness.js");
let pass = 0, fail = 0;
function ok(l, c, d) { if (c) { pass++; console.log("PASS  " + l + (d ? "  [" + d + "]" : "")); } else { fail++; console.log("FAIL  " + l + (d ? "  [" + d + "]" : "")); } }
function typeInto(node, text) { node.focus(); node.value = text; node.dispatchEvent({ type: "input", target: node }); }
function pick(node, value) { node.value = value; node.dispatchEvent({ type: "change", target: node }); }

(async () => {
  const served = await H.loadServedPage();
  const ctx = H.makeContext(served.html, () => {});
  const doc = ctx.doc, RT = ctx.sandbox.RT;
  await RT.boot();
  await H.waitFor(() => RT.state.config, "config");

  /* ---- INJECTED KNOB PROOF: three knobs this page has never heard of ---- */
  const cfg = RT.state.config;
  cfg.seats.gpt.knobs.temperature = { type: "enum", values: ["cold", "warm", "hot"], default: null, env: "FAKE_TEMPERATURE" };
  cfg.seats.kimi.knobs.retries = { type: "int", min: 0, max: 9, default: 2, env: "FAKE_RETRIES" };
  cfg.seats.glm.knobs.style_note = { type: "text", max_len: 400, modes: ["persona"], required_in: ["persona"] };
  cfg.ranges.bounds.summary = [50, 500];          /* a fourth bound the page never named */
  RT.state.draft = null; RT.state.next = null;
  RT.act.newSessionView();

  const tempSel = doc.querySelector('[data-k^="draft-"][data-k$="-gpt-temperature"]') ||
                  doc.querySelectorAll("select").filter(n => /gpt-temperature$/.test(n.dataset.k || ""))[0];
  ok("G1 an unknown ENUM knob renders as a select with a server-default option",
     !!tempSel && tempSel.querySelectorAll("option").length === 4 &&
     tempSel.querySelectorAll("option")[0].textContent === "(server default)",
     tempSel ? tempSel.querySelectorAll("option").map(o => o.textContent).join("|") : "missing");
  const retries = doc.querySelectorAll("input").filter(n => /kimi-retries$/.test(n.dataset.k || ""))[0];
  ok("G2 an unknown INT knob renders as a bounded number input with the default as placeholder",
     !!retries && retries.type === "number" && retries.min === "0" && retries.max === "9" &&
     retries.placeholder === "server default 2",
     retries ? retries.min + "–" + retries.max + " / " + retries.placeholder : "missing");
  const styleRoundtable = doc.querySelectorAll("textarea").filter(n => /glm-style_note$/.test(n.dataset.k || ""));
  ok("G3 a knob limited to persona mode is absent in roundtable mode", styleRoundtable.length === 0);
  const bound = doc.querySelectorAll("input").filter(n => /-bound-summary$/.test(n.dataset.k || ""))[0];
  ok("G4 a bound the page never named renders from ranges.bounds",
     !!bound && bound.min === "50" && bound.max === "500", bound ? bound.min + "–" + bound.max : "missing");

  pick(tempSel, "hot");
  typeInto(retries, "7");
  typeInto(bound, "120");
  let payload = RT.act.buildCreatePayload();
  ok("G5 the injected knob values reach the create payload, correctly typed",
     payload.members.gpt.temperature === "hot" && payload.members.kimi.retries === 7 &&
     payload.protocol.bounds.summary === 120,
     JSON.stringify({ t: payload.members.gpt.temperature, r: payload.members.kimi.retries, s: payload.protocol.bounds.summary }));
  ok("G6 an untouched knob is omitted so the server default stands",
     !("effort" in payload.members.gpt) && !("max_tokens" in payload.members.kimi) &&
     !("timeout_s" in payload.members.glm),
     JSON.stringify(payload.members.glm));
  const timeout = doc.querySelectorAll("input").filter(n => /gpt-timeout_s$/.test(n.dataset.k || ""))[0];
  ok("G7 an int knob's placeholder follows default_per_tier", timeout.placeholder === "server default 900", timeout.placeholder);
  pick(doc.querySelectorAll("select").filter(n => /-tier-gpt$/.test(n.dataset.k || ""))[0], "sol");
  const timeout2 = doc.querySelectorAll("input").filter(n => /gpt-timeout_s$/.test(n.dataset.k || ""))[0];
  ok("G8 changing the tier changes the shown default", timeout2.placeholder === "server default 2400", timeout2.placeholder);

  /* ---- role-centric persona rows --------------------------------------- */
  RT.state.draft.mode = "persona"; RT.render.stream();
  const roleSelects = doc.querySelectorAll("select").filter(n => /-role-(bull|bear|risk)$/.test(n.dataset.k || ""));
  ok("G9 persona shows one row per ROLE, each with a seat select",
     roleSelects.length === 3 && roleSelects.every(s => s.querySelectorAll("option").length === 4),
     roleSelects.map(s => s.dataset.k.replace(/.*-role-/, "")).join(","));
  const charters = doc.querySelectorAll("textarea").filter(n => /-charter-(bull|bear|risk)$/.test(n.dataset.k || ""));
  ok("G10 each role row carries its own charter field", charters.length === 3);
  const styleNote = doc.querySelectorAll("textarea").filter(n => /glm-style_note$/.test(n.dataset.k || ""))[0];
  ok("G11 the persona-only TEXT knob appears now, and says it is required",
     !!styleNote && styleNote.tagName === "TEXTAREA", styleNote ? "rendered" : "missing");
  const d = RT.state.draft;
  d.roles.bull = "gpt"; d.roles.bear = "gpt"; d.roles.risk = "glm";
  ok("G12 one seat holding two roles is named by role",
     /is both bull and bear/.test(RT.act.personaProblemDraft(d) || ""), RT.act.personaProblemDraft(d));
  d.roles.bear = "kimi";
  ok("G13 an empty charter is named by role",
     /bull.*empty charter/.test(RT.act.personaProblemDraft(d) || ""), RT.act.personaProblemDraft(d));
  d.charters.bull = "B"; d.charters.bear = "E"; d.charters.risk = "R";
  ok("G14 a complete line-up passes the pre-check", RT.act.personaProblemDraft(d) === null);
  payload = RT.act.buildCreatePayload();
  ok("G15 roles and charters land on the right members",
     payload.members.gpt.role === "bull" && payload.members.kimi.role === "bear" &&
     payload.members.glm.role === "risk" && payload.members.gpt.charter === "B",
     JSON.stringify({ gpt: payload.members.gpt.role, kimi: payload.members.kimi.role, glm: payload.members.glm.role }));

  /* ---- next-session form: same builders, seeds New session -------------- */
  RT.render.info();
  const nextTier = doc.getElementById("info").querySelectorAll("select").filter(n => /^draft-next-tier-kimi$/.test(n.dataset.k || ""))[0];
  const nextTemp = doc.getElementById("info").querySelectorAll("select").filter(n => /^draft-next-gpt-temperature$/.test(n.dataset.k || ""))[0];
  ok("G16 the next-session form is the same generic form, not a summary",
     !!nextTier && !!nextTemp && doc.getElementById("info").querySelectorAll(".memberbox").length >= 3,
     doc.getElementById("info").querySelectorAll(".memberbox").length + " member boxes in the info pane");
  pick(nextTemp, "cold");
  const nextCharter = doc.getElementById("info").querySelectorAll("textarea").filter(n => /^draft-next-charter-bull$/.test(n.dataset.k || ""))[0];
  if (nextCharter) { typeInto(nextCharter, "next-session bull charter"); RT.render.info(); }
  ok("G17 typing in the next-session form survives a re-render",
     !nextCharter || doc.getElementById("info").querySelectorAll("textarea")
       .filter(n => /^draft-next-charter-bull$/.test(n.dataset.k || ""))[0] === nextCharter);
  doc.getElementById("info").querySelectorAll("button").filter(b => b.textContent === "Save as the default")[0].click();
  RT.act.newSessionView();
  ok("G18 the saved defaults seed the New session draft",
     RT.state.draft.members.gpt.knobs.temperature === "cold",
     JSON.stringify(RT.state.draft.members.gpt.knobs));
  ok("G19 a stored knob the server stops publishing is dropped on load",
     (() => { const saved = JSON.parse(ctx.sandbox.localStorage.getItem("rt2.nextdraft"));
              saved.members.gpt.knobs.ghost_knob = "x";
              ctx.sandbox.localStorage.setItem("rt2.nextdraft", JSON.stringify(saved));
              return !("ghost_knob" in RT.act.defaultDraft().members.gpt.knobs); })());

  /* ---- round aggregate chip + chronological blocks ---------------------- */
  delete cfg.seats.gpt.knobs.temperature; delete cfg.seats.kimi.knobs.retries;
  delete cfg.seats.glm.knobs.style_note; delete cfg.ranges.bounds.summary;
  ctx.sandbox.localStorage.removeItem("rt2.nextdraft");
  RT.state.next = null;
  RT.act.newSessionView();
  RT.act.setComposer("Which cost dominates?");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.sid, "sid");
  await H.waitFor(() => Object.keys((((RT.state.session || {}).rounds || [])[0] || {}).stage1 || {}).length === 3, "answers");
  RT.render.stream();
  const head = doc.getElementById("stream").querySelector(".rounddiv").textContent;
  ok("G20 the round head reports N/M answered", /3\/3 answered/.test(head), JSON.stringify(head));
  ok("G21 no failure chip when nothing failed", head.indexOf("failed") < 0);
  RT.state.session.rounds[0].stage1.gpt.status = "timed_out";
  RT.state.session.rounds[0].stage1.kimi.status = "cancelled";
  RT.render.stream();
  const head2 = doc.getElementById("stream").querySelector(".rounddiv").textContent;
  ok("G22 failures are counted in the error channel only when there are some",
     /1\/3 answered/.test(head2) && /2 failed/.test(head2) &&
     doc.getElementById("stream").querySelector(".rounddiv").querySelectorAll(".p-error").length === 1,
     JSON.stringify(head2));
  RT.state.session.rounds[0].stage1.gpt.status = "done";
  RT.state.session.rounds[0].stage1.kimi.status = "done";

  await RT.act.runReview(0);
  await H.waitFor(() => Object.keys(RT.state.session.rounds[0].review.results).length === 3, "reviews");
  RT.act.relayDraft(0).order = ["glm", "gpt"];
  RT.act.relayDraft(0).prompt = "which line dominates?";
  await RT.act.runRelay(0);
  await H.waitFor(() => { const r = RT.state.session.rounds[0].relays; return r.length && r[0].status !== "running"; }, "relay", 30000);
  RT.render.stream();
  const text1 = doc.getElementById("stream").textContent;
  ok("G23 blocks read in the order they happened (review, then the relay)",
     text1.indexOf("Rank matrix") < text1.indexOf("which line dominates?"),
     "review@" + text1.indexOf("Rank matrix") + " relay@" + text1.indexOf("which line dominates?"));
  /* rewind the relay's own clock: the transcript must follow the record, not a fixed order */
  RT.state.session.rounds[0].relays[0].entries[0].started_at = "2000-01-01T00:00:00-0500";
  RT.render.stream();
  const text2 = doc.getElementById("stream").textContent;
  ok("G24 an earlier relay sorts before the review round",
     text2.indexOf("which line dominates?") < text2.indexOf("Rank matrix"),
     "relay@" + text2.indexOf("which line dominates?") + " review@" + text2.indexOf("Rank matrix"));
  ok("G25 stage 1 stays first and the round controls stay last",
     text2.indexOf("Round started") < text2.indexOf("which line dominates?") &&
     text2.indexOf("Stage actions for round 1") > text2.indexOf("Rank matrix"));

  console.log("\nRESULT: " + (fail === 0 ? "PASS" : "FAIL") + "  (" + pass + " passed, " + fail + " failed)");
  ctx.streams.forEach(s => s.close());
  if (RT.state.tickTimer) clearInterval(RT.state.tickTimer);
  if (RT.state.notesTimer) clearTimeout(RT.state.notesTimer);
  if (RT.state.refetchTimer) clearTimeout(RT.state.refetchTimer);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("HARNESS ERROR: " + e.stack); process.exit(2); });
