/* Supplementary imagined behaviours. The served script runs against the API
   configuration; saved records below are controlled fixtures, not live writes.
   Real layout, themes and motion are also inspected in browser screenshots. */
"use strict";
const H = require("./harness.js");
let pass = 0, fail = 0;
function ok(label, condition) { console.log((condition ? "PASS  " : "FAIL  ") + label); condition ? pass++ : fail++; }
(async () => {
  const served = await H.loadServedPage();
  const ctx = H.makeContext(served.html, () => {}, { innerWidth: 380 });
  const RT = ctx.sandbox.RT, doc = ctx.doc;
  /* makeContext starts the served page because its document is already ready.
     Await that boot; calling it again would wire every click handler twice. */
  await H.waitFor(() => RT.state.config && doc.querySelector('[data-k="closeinfo"]'), "imagined page boot");
  const app = doc.getElementById("app");
  const sidebarButton = doc.getElementById("btnSidebar");
  const infoButton = doc.getElementById("btnInfo");
  sidebarButton.focus(); sidebarButton.click();
  ok("I1 opening the mobile session drawer enters its Close control", app.dataset.sidebar === "on" && doc.activeElement === doc.getElementById("btnCloseSidebar"));
  RT.act.onGlobalKey({ key: "Escape", preventDefault() {} });
  ok("I2 Escape closes the drawer and returns to its opener", app.dataset.sidebar === "off" && doc.activeElement === sidebarButton);
  sidebarButton.click(); infoButton.focus(); infoButton.click();
  ok("I3 changing mobile drawers closes the old drawer and enters the new one", app.dataset.sidebar === "off" && app.dataset.info === "on" && doc.activeElement.dataset.k === "closeinfo");
  doc.activeElement.click();
  ok("I4 the drawer Close button returns keyboard focus", app.dataset.info === "off" && doc.activeElement === infoButton);

  const savedAt = "2026-09-06T12:00:00+00:00";
  const result = { status: "done", run_id: "atlas-answer", text: "A complete independent account.", header: "fixture command", tier: "default", elapsed_s: 8, started_at: savedAt };
  const reviewer = Object.assign({}, result, { run_id: "atlas-review", ranking_seats: ["gpt", "kimi", "glm"], ranking_letters: ["A", "B", "C"] });
  RT.state.sid = "aaaaaaaaaaaaaaaa";
  RT.state.view = "session";
  RT.state.session = {
    id: RT.state.sid, mode: "persona", fake: true, title: "Atlas focus fixture", created: savedAt,
    members: { gpt: { tier: "default", role: "bull" }, kimi: { tier: "default", role: "bear" }, glm: { tier: "default", role: "risk" } },
    protocol: RT.state.config.protocol_defaults,
    rounds: [{ index: 0, question: "Which evidence changes the decision?", context: "", asked_at: savedAt, stage1: { gpt: result }, reruns: [], relays: [], review: { results: { gpt: reviewer }, mapping_per_reviewer: {} } }],
    persona_state: { done: false, next: 0 }, notes: "", exported: {},
    decision: { stance: "hold", rationale: "Keep the conflicting evidence visible.", dissent: "The risk seat remains unconvinced.", saved_at: savedAt }
  };
  RT.render.stream(); RT.render.info();
  const record = doc.getElementById("humanDecision");
  ok("I5 saved human decision appears in the transcript with rationale and dissent", record.textContent.includes("hold") && record.textContent.includes("Keep the conflicting evidence visible.") && record.textContent.includes("The risk seat remains unconvinced."));
  ok("I6 a new decision revision receives its arrival once", record.classList.contains("decision-arrival"));
  const opener = doc.querySelector('[data-k="human-decision-editor"]');
  opener.focus(); opener.click();
  ok("I7 the transcript decision action enters the stance editor", app.dataset.info === "on" && doc.activeElement.dataset.k === "decision-stance");
  RT.render.stream();
  ok("I8 background transcript rendering does not replay the saved decision", !doc.getElementById("humanDecision").classList.contains("decision-arrival"));
  RT.act.onGlobalKey({ key: "Escape", preventDefault() {} });
  ok("I9 Escape from the editor returns to the rebuilt transcript opener", app.dataset.info === "off" && doc.activeElement === doc.querySelector('[data-k="human-decision-editor"]') && doc.activeElement !== opener);
  const matrix = doc.querySelector(".tablewrap");
  ok("I10 the full rank matrix is a named keyboard scroll region", matrix.tabIndex === 0 && matrix.getAttribute("role") === "region" && matrix.getAttribute("aria-label").includes("Model rank matrix"));
  matrix.focus(); RT.render.stream();
  ok("I11 rank-matrix keyboard focus survives an arriving result", doc.activeElement === doc.querySelector(".tablewrap"));
  RT.state.session.decision = {};
  RT.render.stream();
  ok("I12 an unsaved human decision never inherits a model ranking", doc.getElementById("humanDecision").textContent.includes("No human decision has been recorded.") && !doc.getElementById("humanDecision").classList.contains("decision-saved"));
  ctx.sandbox.innerWidth = 1280;
  infoButton.focus(); RT.act.setPane("info", true);
  ok("I13 opening a desktop pane leaves focus on its control", doc.activeElement === infoButton);
  const main = doc.getElementById("main"), sidebar = doc.getElementById("sidebar"), info = doc.getElementById("info");
  doc.getElementById("msg").focus();
  ctx.fireResize(380); await H.sleep(180);
  ok("I14 resizing into an open mobile drawer blocks covered focus and preserves header access", main.inert && sidebar.inert && !info.inert && !doc.getElementById("topbar").inert && doc.activeElement.dataset.k === "closeinfo");
  ctx.fireResize(1280); await H.sleep(180);
  ok("I15 desktop resize releases inert and replaces focus on the mobile-only Close control", !main.inert && !sidebar.inert && !info.inert && doc.activeElement === infoButton);
  ctx.fireResize(380); await H.sleep(180);
  doc.querySelector('[data-k="closeinfo"]').focus(); doc.activeElement.click();
  ok("I16 closing the mobile drawer releases the transcript before returning focus", !main.inert && !sidebar.inert && !info.inert && doc.activeElement === doc.getElementById("msg"));
  console.log("RESULT: " + (fail ? "FAIL" : "PASS") + "  (" + pass + " passed, " + fail + " failed)");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL  suite crashed: " + e.stack); process.exit(1); });
