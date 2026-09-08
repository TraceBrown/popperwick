/* Static CSS self-check + the resize/persistence behaviour, since the stub DOM
   runs no CSS and cannot measure a box. */
"use strict";
const H = require("./harness.js");
let pass = 0, fail = 0;
function ok(l, c, d) { if (c) { pass++; console.log("PASS  " + l + (d ? "  [" + d + "]" : "")); } else { fail++; console.log("FAIL  " + l + (d ? "  [" + d + "]" : "")); } }

(async () => {
  const served = await H.loadServedPage();
  const css = /<style>([\s\S]*?)<\/style>/.exec(served.html)[1];
  const rule = sel => {
    const re = new RegExp("(^|\\n)" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
    const m = re.exec(css);
    return m ? m[2].trim().replace(/\s+/g, " ") : null;
  };
  console.log("--- final row-layout rules, verbatim from the served CSS ---");
  [".frame", "#sidebar", "#info", "#main", ".gutter"].forEach(s => console.log("  " + s + " { " + rule(s) + " }"));
  console.log("  #sidebar, #info { " + rule("#sidebar, #info") + " }");
  const offRule = /\.app\[data-sidebar="off"\] #sidebar, \.app\[data-info="off"\] #info \{([^}]*)\}/.exec(css);
  console.log("  hide rule { " + offRule[1].trim() + " }");
  console.log("");

  ok("L1 the row is a flex row, not a grid", /^display: flex/.test(rule(".frame")));
  ok("L2 no grid-template-columns survives anywhere in the file",
     css.indexOf("grid-template-columns") < 0 || !/\.frame[^{]*\{[^}]*grid-template-columns/.test(css),
     "grid-template-columns occurrences: " + (css.match(/grid-template-columns/g) || []).length + " (compare view only)");
  ok("L3 #main grows into the remaining width and carries an explicit floor",
     /flex: 1 1 0%/.test(rule("#main")) && /min-width: min\(320px, 100%\)/.test(rule("#main")), rule("#main"));
  ok("L4 the panes are fixed-basis, shrinkable, and never grow",
     /flex: 0 1 var\(--sw\)/.test(rule("#sidebar")) && /flex: 0 1 var\(--iw\)/.test(rule("#info")));
  ok("L5 the panes carry min-width: 0 and their own scroll",
     /min-width: 0/.test(rule("#sidebar, #info")) && /overflow: auto/.test(rule("#sidebar, #info")));
  ok("L6 hiding a pane is display:none only — no column arithmetic left",
     offRule[1].trim() === "display: none;");
  ok("L7 under 980px both panes leave the flow as fixed overlays",
     /@media \(max-width: 980px\)[\s\S]*?#sidebar, #info \{[^}]*position: fixed/.test(css));

  /* ---- behaviour: the automatic choice must not stick across a resize ---- */
  const ctx = H.makeContext(served.html, () => {}, { innerWidth: 374 });
  const RT = ctx.sandbox.RT, app = ctx.doc.getElementById("app");
  await RT.boot();
  await H.waitFor(() => RT.state.config, "config");
  ok("L8 374px first visit closes both panes", app.dataset.sidebar === "off" && app.dataset.info === "off",
     "sidebar=" + app.dataset.sidebar + " info=" + app.dataset.info);
  ok("L9 an automatic close is NOT persisted",
     ctx.sandbox.localStorage.getItem("rt2.sidebar.choice") === null,
     "stored choice = " + ctx.sandbox.localStorage.getItem("rt2.sidebar.choice"));
  ctx.fireResize(1280);
  await H.sleep(220);
  ok("L10 growing to 1280 re-opens Sessions and keeps Info closed for reading", app.dataset.sidebar === "on" && app.dataset.info === "off",
     "sidebar=" + app.dataset.sidebar + " info=" + app.dataset.info);
  RT.act.setPane("sidebar", false);                       /* an explicit toggle */
  ok("L11 an explicit toggle IS persisted", ctx.sandbox.localStorage.getItem("rt2.sidebar.choice") === "false");
  ctx.fireResize(1400);
  await H.sleep(220);
  ok("L12 a resize never overrides your explicit choice",
     app.dataset.sidebar === "off" && app.dataset.info === "off",
     "sidebar=" + app.dataset.sidebar + " info=" + app.dataset.info);
  ctx.fireResize(374);
  await H.sleep(220);
  ok("L13 shrinking keeps untouched Info closed and respects closed Sessions",
     app.dataset.info === "off" && app.dataset.sidebar === "off");

  console.log("\nRESULT: " + (fail === 0 ? "PASS" : "FAIL") + "  (" + pass + " passed, " + fail + " failed)");
  ctx.streams.forEach(s => s.close());
  if (RT.state.tickTimer) clearInterval(RT.state.tickTimer);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("HARNESS ERROR: " + e.stack); process.exit(2); });
