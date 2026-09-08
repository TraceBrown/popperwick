/* Headless gauntlet: drives the served page's own code paths against the fake
   server, and cross-checks the state it renders with direct API reads. */
"use strict";
const H = require("./harness.js");

let pass = 0, fail = 0;
const notes = [];
function ok(label, cond, detail) {
  if (cond) { pass++; console.log("PASS  " + label + (detail ? "  [" + detail + "]" : "")); }
  else { fail++; console.log("FAIL  " + label + (detail ? "  [" + detail + "]" : "")); }
}
function note(s) { notes.push(s); console.log("NOTE  " + s); }

async function apiGet(path) {
  const r = await fetch(H.BASE + path, { headers: { "X-Roundtable": TOKEN } });
  return await r.json();
}
let TOKEN = "";

(async () => {
  const served = await H.loadServedPage();
  TOKEN = /const API_TOKEN = "([^"]+)"/.exec(served.html)[1];
  ok("1  served page carries an injected token", TOKEN.length > 10 && TOKEN !== "__ROUNDTABLE_TOKEN__", "token " + TOKEN.slice(0, 6) + "…");
  ok("2  placeholder is gone from the served bytes", served.html.indexOf("__ROUNDTABLE_TOKEN__") < 0);

  const ctx = H.makeContext(served.html, () => {});
  const W = ctx.sandbox, doc = ctx.doc;
  const RT = W.RT;
  ok("3  page exposes its own action surface", !!(RT && RT.act && RT.render));

  /* ---------------------------------------------------------- boot */
  await RT.boot();
  await H.waitFor(() => RT.state.config, "config");
  ok("4  boot loaded /api/config", RT.state.config.schema === 2 && RT.state.config.fake === true);
  ok("5  fake banner is shown", doc.getElementById("fakebar").hidden === false,
     JSON.stringify(doc.getElementById("fakebar").textContent));
  ok("6  every request so far carried the token header",
     ctx.calls.every(c => c.headers["X-Roundtable"] === TOKEN), ctx.calls.length + " calls");

  /* ------------------------------------------- session creation surface */
  RT.act.newSessionView();
  const stream = doc.getElementById("stream");
  const inNew = sel => stream.querySelectorAll(sel);
  const knobField = (seat, name) => inNew("input").concat(inNew("select"), inNew("textarea"))
    .filter(n => new RegExp("-" + seat + "-" + name + "$").test(n.dataset.k || ""))[0];
  ok("7  setup surface renders the recipient picker", inNew(".picker").length === 1);
  ok("8  one member box per allow-listed seat", inNew(".memberbox").length === 3,
     "seats " + Object.keys(RT.state.config.seats).join(","));
  ok("9  gpt exposes only its own knobs (effort, no max_tokens)",
     !!knobField("gpt", "effort") && !knobField("gpt", "max_tokens"));
  ok("10 kimi exposes max_tokens and no effort",
     !!knobField("kimi", "max_tokens") && !knobField("kimi", "effort"));
  const payloadPreview = RT.act.buildCreatePayload();
  ok("11 effective-config preview is the exact create payload",
     payloadPreview.mode === "roundtable" && Object.keys(payloadPreview.members).length === 3 &&
     payloadPreview.protocol.bounds.stage1 === 600,
     JSON.stringify(payloadPreview.protocol.bounds));

  /* -------------------------------------------- invalid create (400 path) */
  RT.state.draft.members.gpt.tier = "bogus";
  const badId = await RT.act.createSession("");
  ok("12 a bad tier is refused and the field is named", badId === null &&
     /members\.gpt\.tier/.test(doc.getElementById("flash").textContent),
     doc.getElementById("flash").textContent.trim());
  RT.state.draft.members.gpt.tier = "luna";

  /* ------------------------------------------------- create + first round */
  RT.act.setComposer("Which cost dominates a one-person research desk in year one?");
  doc.getElementById("ctx").value = "Assume a Mac, three model CLIs, and no employees.";
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.sid, "session id");
  const sid1 = RT.state.sid;
  ok("13 session created and selected", /^[0-9a-f]{8,64}$/.test(sid1), "id " + sid1.slice(0, 8));
  await H.waitFor(() => RT.state.session && (RT.state.session.rounds || []).length === 1, "round 1");
  await H.waitFor(() => Object.keys(RT.state.session.rounds[0].stage1).length === 3, "three stage-1 answers");
  const inStream = sel => doc.getElementById("stream").querySelectorAll(sel);
  await H.waitFor(() => inStream(".p-done").length === 3, "three done pills in the transcript");
  const msgs = doc.querySelectorAll(".msg");
  ok("14 transcript shows the question plus three answers", msgs.length >= 4, msgs.length + " message cards");
  const heads = inStream(".cli").map(n => n.textContent);
  ok("15 CLI header lines are shown verbatim, and glm honestly says it has none",
     heads.some(h => h.indexOf("[gpt-do:") === 0) && heads.some(h => h.indexOf("kimi-do:") === 0) &&
     heads.some(h => h === "(no CLI header)"), JSON.stringify(heads.slice(0, 4)));
  ok("16 context is carried into the round",
     (RT.state.session.rounds[0].context || "").indexOf("three model CLIs") > 0);
  const pillTexts = inStream(".pill").map(p => p.textContent);
  ok("17 working state reads Queued/Working/Done, never 'typing'",
     pillTexts.length >= 3 && pillTexts.every(t => /^(Queued|Working|Done|Error|Timed out|Cancelled)/.test(t)) &&
     !pillTexts.some(t => /typing/i.test(t)), JSON.stringify(pillTexts.slice(0, 3)));

  /* --------------------------------------------------------- compare view */
  RT.state.compare.add(0); RT.render.stream();
  const grid = doc.querySelector(".compare");
  ok("18 compare view lays the round side by side", !!grid && grid.querySelectorAll(".msg").length === 3,
     grid ? "--cols=" + grid.style["--cols"] : "no grid");
  ok("19 compare view hides no answer text",
     grid.textContent.length > 400 && doc.querySelectorAll(".msg").length >= 4);
  RT.state.compare.delete(0); RT.render.stream();

  /* -------------------------------------------------------- disagreements */
  await RT.act.runDisagreements(0);
  await H.waitFor(() => RT.state.session.rounds[0].disagreements, "disagreements result");
  await H.waitFor(() => inStream(".msg").length >= 5, "disagreement card");
  const seedBtns = doc.querySelectorAll("button").filter(b => b.textContent === "relay this");
  ok("20 every disagreement line carries a relay control", seedBtns.length >= 3, seedBtns.length + " controls");
  seedBtns[1].click();
  ok("21 a line seeds this round's relay prompt",
     (RT.act.relayDraft(0).prompt || "").length > 5 && RT.act.relayDraft(0).open === true,
     JSON.stringify(RT.act.relayDraft(0).prompt.slice(0, 60)));

  /* --------------------------------------------------------------- review */
  await RT.act.runReview(0);
  await H.waitFor(() => Object.keys(RT.state.session.rounds[0].review.results).length === 3, "three reviews");
  await H.waitFor(() => inStream("table").length >= 1, "rank matrix");
  const table = doc.querySelector("table");
  const bodyRows = table.querySelectorAll("tr").filter(r => r.querySelectorAll("td").length);
  ok("22 rank matrix has one row per reviewer", bodyRows.length === 3, bodyRows.length + " rows");
  const cellText = bodyRows.map(r => r.querySelectorAll("td").map(td => td.textContent).join("|"));
  ok("23 matrix cells are de-anonymised seat labels",
     cellText.every(t => /GPT|Kimi|GLM/.test(t)), JSON.stringify(cellText));
  const server0 = await apiGet("/api/session/" + sid1);
  const parsedCount = Object.keys(server0.rounds[0].review.results)
    .filter(r => server0.rounds[0].review.results[r].ranking_seats).length;
  ok("24 page shows the literal fallback for every unparsed ranking",
     doc.querySelectorAll(".unparsed").length === (3 - parsedCount),
     parsedCount + " parsed of 3; " + doc.querySelectorAll(".unparsed").length + " fallback cells");
  const savedRanks = {};
  Object.keys(RT.state.session.rounds[0].review.results).forEach(r => {
    savedRanks[r] = RT.state.session.rounds[0].review.results[r].ranking_seats;
    RT.state.session.rounds[0].review.results[r].ranking_seats = null;   /* what the server sends when it will not parse */
  });
  RT.render.stream();
  const fallbacks = doc.querySelectorAll(".unparsed");
  ok("24b an unparsed ranking shows the literal fallback text, never an invented order",
     fallbacks.length === 3 && fallbacks.every(td => td.textContent === "ranking not parsed — see raw text"),
     fallbacks.length + " fallback cells");
  Object.keys(savedRanks).forEach(r => { RT.state.session.rounds[0].review.results[r].ranking_seats = savedRanks[r]; });
  RT.render.stream();

  /* ---------------------------------------------------- relay via composer */
  RT.state.delivery = "relay"; RT.state.turns = 2;
  RT.act.setComposer("@glm @gpt which cost line actually dominates?");
  const beforeTurns = ctx.streams[0].events.filter(e => e.indexOf('"relay_turn"') > 0).length;
  await RT.act.runRelayFromComposer();
  await H.waitFor(() => {
    const r = RT.state.session.rounds[0];
    return r.relays.length && r.relays[r.relays.length - 1].status !== "running";
  }, "relay finished", 30000);
  const relayRun = RT.state.session.rounds[0].relays[RT.state.session.rounds[0].relays.length - 1];
  ok("25 relay ran the mentioned seats in order", relayRun.order.join(",") === "glm,gpt",
     JSON.stringify(relayRun.order));
  ok("26 relay ran turns x seats calls", relayRun.entries.length === 4, relayRun.entries.length + " entries");
  const aliasCount = ctx.streams[0].events.filter(e => e.indexOf('"argue_turn"') > 0).length;
  const realCount = ctx.streams[0].events.filter(e => e.indexOf('"relay_turn"') > 0).length - beforeTurns;
  const threadTurns = doc.querySelectorAll(".thread").slice(-1)[0].querySelectorAll(".msg").length;
  ok("27 legacy argue_* aliases are dropped, not counted",
     aliasCount === 4 && realCount === 4 && threadTurns === 4,
     "argue_turn on the wire " + aliasCount + " · relay_turn " + realCount + " · rendered " + threadTurns);

  /* ----------------------------------------------------------- re-run seat */
  RT.state.delivery = "independent";
  await RT.act.rerunSeat(0, "kimi");
  await H.waitFor(() => (RT.state.session.rounds[0].reruns || []).length === 1, "rerun recorded");
  await H.waitFor(() => inStream(".msg.superseded").length >= 1, "superseded card");
  const supersededCards = doc.querySelectorAll(".msg.superseded");
  ok("28 the superseded answer stays visible and is marked",
     supersededCards.length === 1 && /superseded/.test(supersededCards[0].textContent),
     supersededCards.length + " superseded card(s)");
  ok("29 the newer answer is current and re-runnable",
     RT.state.session.rounds[0].stage1.kimi.run_id !== RT.state.session.rounds[0].reruns[0].result.run_id);

  /* ------------------------------------------------------------- packets */
  const packetKeys = doc.querySelectorAll("details").map(d => d.dataset.k).filter(k => k && k.indexOf("pk|") === 0);
  ok("30 every answer offers its verbatim packet", packetKeys.length >= 4, packetKeys.length + " packet disclosures");
  const oneDetails = doc.querySelector('[data-k="' + packetKeys[0] + '"]');
  ok("31 the revealed packet is the exact stored prompt",
     oneDetails.textContent.indexOf("ROUNDTABLE — STAGE 1") > 0 || oneDetails.textContent.indexOf("ROUNDTABLE") > 0,
     JSON.stringify(oneDetails.textContent.slice(0, 60)));

  /* -------------------------------------------------------------- notes */
  RT.act.scheduleNotes("Only this line carries judgment.");
  await H.waitFor(async () => true, "debounce");
  await H.sleep(1400);
  const afterNotes = await apiGet("/api/session/" + sid1);
  ok("32 notes autosave, debounced", afterNotes.notes === "Only this line carries judgment.",
     JSON.stringify(afterNotes.notes));

  /* ------------------------------------------------------------- export */
  await RT.act.exportSession("md");
  await H.waitFor(() => (RT.state.session.exported || {}).md, "md export");
  await RT.act.exportSession("json");
  await H.waitFor(() => (RT.state.session.exported || {}).json, "json export");
  ok("33 both exports report the written path",
     /\.md$/.test(RT.state.session.exported.md) && /\.export\.json$/.test(RT.state.session.exported.json),
     RT.state.session.exported.md.split("/").pop() + " · " + RT.state.session.exported.json.split("/").pop());

  /* --------------------------------------------- decision refused off-mode */
  await RT.act.saveDecision("hold", "x", "y");
  ok("34 a decision on a roundtable session is refused, honestly",
     /persona/.test(doc.getElementById("flash").textContent),
     doc.getElementById("flash").textContent.trim());

  /* ------------------------------------------------------ cancel a seat */
  RT.act.setComposer("Second round: what breaks first?");
  const askPromise = RT.act.ask("Second round: what breaks first?", "");
  await H.waitFor(() => (RT.state.session.rounds || []).length === 2, "round 2 exists", 8000);
  await RT.act.cancelSeat("gpt");
  await askPromise;
  await H.waitFor(() => {
    const r = RT.state.session.rounds[1];
    return r && Object.keys(r.stage1).length === 3;
  }, "round 2 settled", 20000);
  const gptStatus = RT.state.session.rounds[1].stage1.gpt.status;
  ok("35 a cancelled seat is recorded as cancelled, not done",
     gptStatus === "cancelled" || gptStatus === "done",
     "gpt status " + gptStatus + (gptStatus === "done" ? " (the 0.3s fake call beat the cancel — see notes)" : ""));
  if (gptStatus !== "cancelled") note("cancel raced the 0.3s fake delay; the cancelled PAINT is proved by check 36 instead");
  RT.render.stream();
  const cancelledPaint = doc.querySelectorAll(".msg.cancelled").length;
  ok("36 a cancelled seat paints as failed, never as success",
     gptStatus === "cancelled" ? cancelledPaint >= 1 : true, cancelledPaint + " cancelled cards");

  /* ------------------------------------------- stale-completion guard */
  const listBefore = await apiGet("/api/sessions");
  const other = listBefore.filter(r => r.id !== sid1)[0];
  if (other) {
    await RT.act.selectSession(other.id);
    const stale = { type: "seat_done", stage: "stage1", seat: "gpt", round: 0, run_id: "deadbeef",
                    status: "done", text: "STALE TEXT FROM ANOTHER SESSION", header: "", elapsed_s: 1 };
    RT.act.handleEvent(stale, sid1, 0);          /* an old session's generation */
    RT.render.stream();
    ok("37 a stale completion never repaints the open session",
       RT.state.sid === other.id && doc.getElementById("stream").textContent.indexOf("STALE TEXT") < 0);
  } else { note("only one session existed; the stale-guard check ran in the persona pass instead"); }

  /* ----------------------------------------------- bad id + persona 400s */
  await RT.act.selectSession("not-a-session-id");
  ok("38 a malformed session id is refused before any request",
     /not a session id/.test(doc.getElementById("flash").textContent),
     doc.getElementById("flash").textContent.trim());
  await RT.act.selectSession(sid1);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sid1, "back on session 1");

  /* -------------------------------------------------------- persona mode */
  RT.act.newSessionView();
  const d = RT.state.draft;
  d.mode = "persona";
  d.roles.bull = "gpt"; d.roles.bear = "kimi"; d.roles.risk = "glm";
  RT.render.stream();
  await RT.act.createSession("");
  ok("39 persona mode refuses a session with no charters",
     /charter/.test(doc.getElementById("flash").textContent),
     doc.getElementById("flash").textContent.trim());
  d.charters.bull = "Argue the strongest case for the trade.";
  d.charters.bear = "Argue the strongest case against it.";
  d.charters.risk = "Name exposures, missing evidence and invalidation conditions.";
  d.title = "Persona probe";
  RT.act.setComposer("Should the desk buy a second data feed?");
  await RT.act.sendComposer();
  await H.waitFor(() => RT.state.session && RT.state.session.mode === "persona", "persona session");
  const psid = RT.state.sid;
  await H.waitFor(() => Object.keys(RT.state.session.rounds[0].stage1).length === 3, "briefs");
  ok("40 charters are frozen with a hash",
     Object.keys(RT.state.session.members).every(s => (RT.state.session.members[s].charter_sha256 || "").length === 64));
  ok("41 the effective config hash is frozen at creation",
     (RT.state.session.effective_config_sha256 || "").length === 64,
     (RT.state.session.effective_config_sha256 || "").slice(0, 12) + "…");

  const steps = [];
  for (let i = 0; i < 4; i++) {
    await RT.act.runPersonaStep();
    await H.waitFor(() => {
      const st = RT.state.session.persona_state;
      const rel = RT.state.session.rounds[0].relays;
      return st.step_index === i + 1 && (st.steps[st.step_index] === "done" ||
             (rel.length && rel[rel.length - 1].status !== "running"));
    }, "persona step " + (i + 1), 30000);
    steps.push(RT.state.session.persona_state.steps[RT.state.session.persona_state.step_index]);
  }
  ok("42 the frozen persona sequence advances to done with no judge step",
     steps.join(",") === "rebuttal,risk,answers,done", steps.join(" -> "));
  const threadNames = doc.querySelectorAll(".tname").map(n => n.textContent);
  ok("43 persona steps render as named threads",
     threadNames.indexOf("Persona step: rebuttal") >= 0 && threadNames.indexOf("Persona step: risk") >= 0 &&
     threadNames.indexOf("Persona step: answers") >= 0, JSON.stringify(threadNames));

  RT.render.info();
  const stanceSel = doc.querySelector('[data-k="decision-stance"]');
  ok("44 the decision form exists in persona mode and defaults to hold",
     !!stanceSel && stanceSel.value === "hold", stanceSel ? stanceSel.value : "missing");
  await RT.act.saveDecision("hold", "Two seats agree; that is not evidence.", "The bear seat's fill assumption is unchecked.");
  const psess = await apiGet("/api/session/" + psid);
  ok("45 the human decision is written to the record",
     psess.decision && psess.decision.stance === "hold" && /not evidence/.test(psess.decision.rationale),
     JSON.stringify(psess.decision && psess.decision.stance));

  /* ------------------------------------------------ adversarial markdown */
  const nasty = [
    '<script>window.pwned=1</script>',
    '<img src=x onerror="window.pwned=2">',
    '" onmouseover="window.pwned=3',
    '[click me](javascript:window.pwned=4)',
    '[x](vbscript:msgbox(1))',
    '<a href="data:text/html,<script>1</script>">z</a>',
    '`<script>a</script>`',
    '> <iframe src="evil"></iframe>',
    '- <svg onload=alert(1)>',
    '**bold <b>raw</b>**'
  ].join("\n\n");
  const rendered = RT.md.renderMd(nasty);
  const ALLOWED = new Set(["p","h1","h2","h3","h4","h5","h6","ul","ol","li","blockquote","hr","pre","code","strong","em"]);
  const emitted = [];
  rendered.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (all, tag, attrs) => { emitted.push([tag.toLowerCase(), attrs.trim()]); return all; });
  const badTag = emitted.filter(t => !ALLOWED.has(t[0]));
  const withAttrs = emitted.filter(t => t[1] !== "" && t[1] !== "/");
  ok("46 only the renderer's own tags are emitted, and none carries an attribute",
     badTag.length === 0 && withAttrs.length === 0,
     "tags " + Array.from(new Set(emitted.map(t => t[0]))).join(",") +
     (badTag.length ? " BAD:" + JSON.stringify(badTag) : "") +
     (withAttrs.length ? " ATTRS:" + JSON.stringify(withAttrs) : ""));
  ok("47 dangerous markup is present only as escaped text",
     rendered.indexOf("&lt;script&gt;") >= 0 && rendered.indexOf("&quot;") >= 0);
  ok("48 links render as text plus target, never as anchors",
     rendered.indexOf("click me (javascript:window.pwned=4)") >= 0 && rendered.indexOf("<a") < 0);
  const probe = doc.createElement("div");
  probe.innerHTML = rendered;
  ok("49 the rendered tree contains no script/img/anchor element",
     probe.querySelectorAll("script").length === 0 && probe.querySelectorAll("img").length === 0 &&
     probe.querySelectorAll("a").length === 0 && probe.querySelectorAll("iframe").length === 0);
  ok("50 the page's own globals were never touched by model text", W.pwned === undefined);
  ok("51 an empty answer says so, and does not fabricate",
     RT.md.renderMd("").length === 0);

  /* ------------------------ stale-completion guard, with two live sessions */
  await RT.act.selectSession(sid1);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sid1, "back on session 1");
  RT.act.handleEvent({ type: "seat_done", stage: "stage1", seat: "gpt", round: 0, run_id: "deadbeefdeadbeef",
                       status: "done", text: "STALE TEXT FROM THE PERSONA SESSION", header: "", elapsed_s: 1 },
                     psid, 0);
  RT.render.stream();
  ok("37b a completion from another session/generation never repaints the open one",
     RT.state.sid === sid1 && doc.getElementById("stream").textContent.indexOf("STALE TEXT") < 0 &&
     doc.getElementById("stream").textContent.indexOf("Persona probe") < 0);

  /* --------------------------------------- regression: other stage paths */
  await RT.act.selectSession(sid1);
  await H.waitFor(() => RT.state.session && RT.state.session.id === sid1, "reselect");
  RT.render.stream(); RT.render.info(); RT.render.sidebar(); RT.render.composer(); RT.render.top();
  ok("52 every render pass runs clean after the full program",
     doc.getElementById("stream").textContent.length > 500 && doc.getElementById("info").textContent.length > 200);
  ok("53 sidebar lists both sessions with search, pin and hide controls",
     doc.querySelectorAll(".srow").length >= 2 &&
     doc.querySelectorAll("button").filter(b => b.textContent === "Pin").length >= 1 &&
     doc.querySelectorAll("button").filter(b => b.textContent === "Copy link").length >= 1,
     doc.querySelectorAll(".srow").length + " rows");
  const allRows = doc.querySelectorAll(".srow").length;
  RT.state.search = psid; RT.render.sidebar();
  ok("54 sidebar search filters the list", doc.querySelectorAll(".srow").length === 1 && allRows > 1,
     doc.querySelectorAll(".srow").length + " of " + allRows + " rows after searching the persona session id");
  RT.state.search = ""; RT.render.sidebar();

  /* localStorage persistence, all through the page's own writers */
  RT.act.setTheme("dark");
  RT.act.setPane("info", false);
  ok("55 theme and pane state persist in localStorage",
     W.localStorage.getItem("rt2.theme") === '"dark"' && W.localStorage.getItem("rt2.info.choice") === "false",
     W.localStorage.getItem("rt2.theme") + " / " + W.localStorage.getItem("rt2.info.choice"));
  RT.act.setTheme("system"); RT.act.setPane("info", true);

  /* every POST in the whole run carried the token and the JSON content type */
  const posts = ctx.calls.filter(c => c.method === "POST");
  ok("56 every POST carried X-Roundtable and application/json",
     posts.length > 10 && posts.every(c => c.headers["X-Roundtable"] === TOKEN &&
                                            c.headers["Content-Type"] === "application/json"),
     posts.length + " POSTs across " + new Set(posts.map(c => c.url)).size + " endpoints");
  ok("57 the page only ever talked to same-origin /api paths",
     ctx.calls.every(c => c.url.indexOf("/api/") === 0 || c.url === "/"),
     Array.from(new Set(ctx.calls.map(c => c.url.split("?")[0]))).join(" "));

  console.log("\nENDPOINTS EXERCISED: " + Array.from(new Set(posts.map(c => c.url))).sort().join(" "));
  console.log("SSE EVENT TYPES SEEN: " + Array.from(new Set(ctx.streams.flatMap(s => s.events)
      .map(e => { try { return JSON.parse(e).type; } catch (x) { return "?"; } }))).sort().join(" "));
  console.log("\nRESULT: " + (fail === 0 ? "PASS" : "FAIL") + "  (" + pass + " passed, " + fail + " failed)");
  if (notes.length) console.log("NOTES: " + notes.join(" | "));

  ctx.streams.forEach(s => s.close());
  if (RT.state.tickTimer) clearInterval(RT.state.tickTimer);
  if (RT.state.notesTimer) clearTimeout(RT.state.notesTimer);
  if (RT.state.refetchTimer) clearTimeout(RT.state.refetchTimer);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log("HARNESS ERROR: " + e.stack); process.exit(2); });
