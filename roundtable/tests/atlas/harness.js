/* Loads the SERVED page (token already injected by the server) into a stub DOM
   and runs its real script, so every test below drives the page's own code. */
"use strict";
const vm = require("vm");
const http = require("http");
const { makeDocument, parseHTML } = require("./dom.js");

const BASE = process.env.RT_BASE || "http://127.0.0.1:8802";
/* The disk law must inspect the UI under test, not the unchanged comparison.
   Set RT_UI explicitly when serving a different file. */
const UI_PATH = require("path").resolve(process.env.RT_UI || require("path").join(__dirname, "..", "..", "variants", "C", "index.html"));
function readUI() { return require("fs").readFileSync(UI_PATH, "utf8"); }

async function loadServedPage() {
  const res = await fetch(BASE + "/", { headers: { "X-Roundtable": "unused-on-get" } });
  const html = await res.text();
  return { html, status: res.status };
}

function makeContext(html, log, opts) {
  const doc = makeDocument();
  const bodyHtml = /<body>([\s\S]*?)<\/body>/.exec(html)[1].replace(/<script>[\s\S]*?<\/script>/g, "");
  parseHTML(bodyHtml, doc).forEach(n => doc.body.appendChild(n));
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];

  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
  const calls = [];
  const clip = [];
  const streams = [];

  async function fetchWrap(path, opts) {
    const url = String(path).indexOf("/") === 0 ? BASE + path : path;
    const o = opts || {};
    calls.push({ url: String(path), method: o.method || "GET", headers: Object.assign({}, o.headers || {}), body: o.body });
    return await fetch(url, o);
  }

  class StubEventSource {
    constructor(path) {
      this.path = path;
      this.onmessage = null; this.onopen = null; this.onerror = null;
      this.events = [];
      this.closed = false;
      streams.push(this);
      const url = new URL(BASE + path);
      this.req = http.get({
        hostname: url.hostname, port: url.port, path: url.pathname + url.search,
        headers: { Accept: "text/event-stream" }
      }, res => {
        this.res = res;
        if (this.onopen) this.onopen({ type: "open" });
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", chunk => {
          buf += chunk;
          let at;
          while ((at = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, at);
            buf = buf.slice(at + 2);
            const data = frame.split("\n").filter(l => l.indexOf("data:") === 0)
                              .map(l => l.slice(5).trim()).join("\n");
            if (!data) continue;
            this.events.push(data);
            if (this.onmessage) this.onmessage({ data: data });
          }
        });
        res.on("end", () => { if (this.onerror) this.onerror({ type: "error" }); });
      });
      this.req.on("error", () => { if (this.onerror) this.onerror({ type: "error" }); });
    }
    close() { this.closed = true; try { this.req.destroy(); } catch (e) {} }
  }

  const sandbox = {
    console: { log: (...a) => log("page:", ...a), warn: () => {}, error: (...a) => log("page-err:", ...a) },
    document: doc,
    localStorage: localStorage,
    fetch: fetchWrap,
    EventSource: StubEventSource,
    navigator: { clipboard: { writeText: async t => { clip.push(t); } } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Promise, Error, URL, encodeURIComponent, decodeURIComponent,
    Set, Map, Array, Object, String, Number, Boolean, RegExp, isFinite, parseInt, parseFloat
  };
  const winListeners = {};
  sandbox.addEventListener = (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); };
  sandbox.removeEventListener = (type, fn) => {
    const l = winListeners[type] || []; const at = l.indexOf(fn); if (at >= 0) l.splice(at, 1);
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window.innerWidth = (opts && opts.innerWidth) || 1280;
  sandbox.window.location = { origin: BASE, href: BASE + "/", search: "", pathname: "/" };
  sandbox.window.history = { replaceState: (a, b, url) => { sandbox.window.location.search = (String(url).split("?")[1] ? "?" + String(url).split("?")[1] : ""); } };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: "page.js" });
  const fireResize = width => {
    sandbox.innerWidth = width;
    (winListeners.resize || []).slice().forEach(fn => fn({ type: "resize" }));
  };
  return { sandbox, doc, calls, clip, streams, script, html, fireResize };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(pred, label, ms) {
  const limit = ms || 15000;
  const t0 = Date.now();
  while (Date.now() - t0 < limit) {
    let ok = false;
    try { ok = pred(); } catch (e) { ok = false; }
    if (ok) return true;
    await sleep(60);
  }
  throw new Error("timed out waiting for: " + label);
}
function textOf(node) { return node ? node.textContent : ""; }
function findAll(root, cls) { return root.querySelectorAll("." + cls); }

module.exports = { BASE, UI_PATH, readUI, loadServedPage, makeContext, sleep, waitFor, textOf, findAll };
