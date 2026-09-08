/* Compare-grid auto-fit (user, 2026-09-07): the --cols the compare view sets
   is 1, 2, 3 across for one, two, three seats, and 2 (a 2x2) at four. The fake
   roster carries three seats, so the four-, five-, two- and one-answer rounds
   are made the way round4 makes its fixtures: mutate the round's stage-1
   results (and, for an extra seat, the member list) around RT.render.stream(),
   then restore. Same harness, same PASS/FAIL format as round4; kept out of
   round4.js because that file carries one check per ROUND4-SPEC punch id. */
"use strict";
const H = require("./harness.js");

let pass = 0, fail = 0;
function ok(l, c, d) {
  if (c) { pass++; console.log("PASS  " + l + (d ? "  [" + d + "]" : "")); }
  else { fail++; console.log("FAIL  " + l + (d ? "  [" + d + "]" : "")); }
}
function ruleOf(css, sel) {
  const re = new RegExp("(^|\\n)" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = re.exec(css);
  return m ? m[2].trim().replace(/\s+/g, " ") : null;
}

(async () => {
  const served = await H.loadServedPage();
  const css = /<style>([\s\S]*?)<\/style>/.exec(served.html)[1];

  /* ------------------------------------------------ boot a driven context */
  const ctx = H.makeContext(served.html, () => {});
  const doc = ctx.doc, RT = ctx.sandbox.RT;
  await RT.boot();
  await H.waitFor(() => RT.state.config, "config");
  const stream = doc.getElementById("stream");
  RT.act.newSessionView();
  RT.act.setComposer("Does a fourth seat still fit on one screen?");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.sid, "session id");
  const sid = RT.state.sid;
  await H.waitFor(() => Object.keys((((RT.state.session || {}).rounds || [])[0] || {}).stage1 || {}).length === 3, "three answers");
  await H.waitFor(() => stream.querySelectorAll(".p-done").length === 3, "three done pills");
  /* nothing is out any more: no placeholder may stand in for a dropped result */
  RT.state.live.clear();
  await RT.act.refetch(sid, RT.state.gen);

  const round = RT.state.session.rounds[0];
  const members = RT.state.session.members;
  const grid = () => stream.querySelector(".compare");
  const cols = () => (grid() ? grid().style["--cols"] : "no grid");
  const cells = () => (grid() ? grid().querySelectorAll(".msg") : []);
  const seatsShown = () => cells().map(c => c.querySelector(".mono-tile").dataset.seat).join(",");

  /* ------------------------------------------------------------- three */
  RT.state.compare.add(0); RT.render.stream();
  ok("G1 three seats compare three across",
     cols() === "3" && cells().length === 3, "--cols=" + cols() + " cells=" + seatsShown());

  /* -------------------------------------------------------------- four
     a fourth member with its own settled result, cloned from a real one */
  const donor = round.stage1.glm;
  members.claude = Object.assign({}, members.glm);
  round.stage1.claude = Object.assign({}, donor, {
    run_id: "4444444444444444",
    text: "A fourth, independent answer.\n\nLong enough to wrap inside its cell, with a code span `x` and a list:\n- one\n- two"
  });
  RT.render.stream();
  ok("G2 four seats fold to a 2x2",
     cols() === "2" && cells().length === 4, "--cols=" + cols() + " cells=" + seatsShown());
  ok("G3 every cell of the 2x2 keeps its author row and its persistent actions",
     cells().length === 4 && cells().every(c =>
       !!c.querySelector(".mhead .who") && c.querySelector(".mhead .who").textContent.trim().length > 0 &&
       c.querySelectorAll(".acts button").length >= 5),
     cells().map(c => c.querySelector(".mhead .who").textContent.trim() + ":" + c.querySelectorAll(".acts button").length).join(" "));
  ok("G4 the fourth answer is in its cell in full, and the round head counts it",
     cells()[3].textContent.indexOf("A fourth, independent answer.") >= 0 &&
     cells()[3].textContent.indexOf("two") >= 0 &&
     /4\/4 answered/.test(stream.querySelector(".rounddiv").textContent),
     JSON.stringify(stream.querySelector(".rounddiv").textContent));

  /* -------------------------------------------------------------- five
     the server caps a session at four seats; the page's rule past four is
     still two columns — no paging, nothing hidden */
  members.fifth = Object.assign({}, members.glm);
  round.stage1.fifth = Object.assign({}, donor, { run_id: "5555555555555555", text: "A fifth answer." });
  RT.render.stream();
  ok("G5 past four the grid stays at two columns and every answer stays in it",
     cols() === "2" && cells().length === 5 && grid().textContent.indexOf("A fifth answer.") >= 0,
     "--cols=" + cols() + " cells=" + seatsShown());
  delete members.fifth; delete round.stage1.fifth;
  delete members.claude; delete round.stage1.claude;

  /* ---------------------------------------------------------- two, one
     drop settled results; the seats stay members */
  const savedGlm = round.stage1.glm, savedKimi = round.stage1.kimi;
  delete round.stage1.glm; RT.render.stream();
  ok("G6 two seats compare two across",
     cols() === "2" && cells().length === 2, "--cols=" + cols() + " cells=" + seatsShown());
  delete round.stage1.kimi; RT.render.stream();
  ok("G7 one seat is one column",
     cols() === "1" && cells().length === 1, "--cols=" + cols() + " cells=" + seatsShown());

  /* ------------------------------------------------------------ restore */
  round.stage1.kimi = savedKimi; round.stage1.glm = savedGlm;
  RT.render.stream();
  ok("G8 restored: three seats compare three across again",
     cols() === "3" && cells().length === 3 && Object.keys(members).length === 3,
     "--cols=" + cols() + " cells=" + seatsShown());
  RT.state.compare.delete(0); RT.render.stream();
  ok("G9 stacked view again, all three answers on the record",
     !grid() && stream.querySelectorAll(".p-done").length === 3 &&
     /3\/3 answered/.test(stream.querySelector(".rounddiv").textContent));

  /* ---------------------------------------------------------- the rule */
  ok("G10 the column count is one named table in the page, and it is what feeds --cols",
     /function compareCols\(n\)/.test(served.html) &&
     /const table = \{ 1: 1, 2: 2, 3: 3, 4: 2 \}/.test(served.html) &&
     /setProperty\("--cols", String\(compareCols\(current\.length\)\)\)/.test(served.html) &&
     served.html.indexOf("Math.min(current.length, 3)") < 0);
  ok("G11 the grid still reads --cols with a three-column default and floor-less equal tracks",
     /grid-template-columns: repeat\(var\(--cols, 3\), minmax\(0, 1fr\)\)/.test(ruleOf(css, ".compare")),
     ruleOf(css, ".compare"));
  ok("G12 the 900px collapse to one column is in the CSS verbatim",
     /@media \(max-width: 900px\) \{ \.compare \{ grid-template-columns: minmax\(0, 1fr\); \} \}/.test(css));
  const cqAt = css.indexOf("@container (max-width: 700px) {");
  const cq = cqAt >= 0 ? css.slice(cqAt, css.indexOf("\n}", cqAt)) : "";
  ok("G13 the 700px container collapse to one column is in the CSS verbatim",
     cq.indexOf("\n  .compare { grid-template-columns: minmax(0, 1fr); }") > 0, JSON.stringify(cq.slice(0, 40)));
  ok("G14 a 2x2's rows meet at the card rule: columns keep their 20px gap, rows have none",
     /gap: 0 20px/.test(ruleOf(css, ".compare")) &&
     /border-top: 1px solid var\(--border\)/.test(ruleOf(css, ".compare > .msg")),
     ruleOf(css, ".compare > .msg"));
  ok("G15 the cell prose keeps the transcript's 68ch measure — no compare rule overrides it, and the cell cannot overflow",
     /max-width: 68ch/.test(ruleOf(css, ".msg .prose")) &&
     !/\.compare[^{]*\.prose[^{]*\{[^}]*max-width/.test(css) &&
     /min-width: 0/.test(ruleOf(css, ".msg")) &&
     /overflow-x: auto/.test(ruleOf(css, ".prose pre")),
     ruleOf(css, ".msg .prose"));
  ok("G16 the compare author row lays out as a row and wraps, so four cells do not squeeze it",
     /flex-direction: row/.test(ruleOf(css, ".compare .mhead")) && /flex-wrap: wrap/.test(ruleOf(css, ".compare .mhead")),
     ruleOf(css, ".compare .mhead"));

  console.log("\nRESULT: " + (fail === 0 ? "PASS" : "FAIL") + "  (" + pass + " passed, " + fail + " failed)");
  ctx.streams.forEach(s => s.close());
  if (RT.state.tickTimer) clearInterval(RT.state.tickTimer);
  if (RT.state.notesTimer) clearTimeout(RT.state.notesTimer);
  if (RT.state.refetchTimer) clearTimeout(RT.state.refetchTimer);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("HARNESS ERROR: " + e.stack); process.exit(2); });
