/* Minimal stub DOM for driving the roundtable page headlessly in node.
   Not a browser: just enough of the API surface the page actually touches,
   plus a small HTML parser so the harness loads the page's REAL body markup
   (and so innerHTML assignments become inspectable nodes). */
"use strict";

const VOID = new Set(["input", "br", "hr", "img", "meta", "link", "source"]);

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
function camel(name) { return name.replace(/-([a-z])/g, (m, c) => c.toUpperCase()); }

class ClassList {
  constructor(node) { this.node = node; }
  get _set() { return new Set(String(this.node.className || "").split(/\s+/).filter(Boolean)); }
  _write(set) { this.node.className = Array.from(set).join(" "); }
  add(c) { const s = this._set; s.add(c); this._write(s); }
  remove(c) { const s = this._set; s.delete(c); this._write(s); }
  contains(c) { return this._set.has(c); }
  toggle(c) { const s = this._set; if (s.has(c)) s.delete(c); else s.add(c); this._write(s); }
}

class Node {
  constructor(tag, doc) {
    this.tagName = String(tag || "").toUpperCase();
    this.ownerDocument = doc;
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.classList = new ClassList(this);
    this._listeners = {};
    this._text = null;          /* text nodes only */
    this.nodeType = 1;
    this.scrollTop = 0; this.scrollHeight = 0; this.clientHeight = 0;
  }
  get className() { return this.attributes["class"] || ""; }
  set className(v) { this.attributes["class"] = String(v); }
  get id() { return this.attributes["id"] || ""; }
  set id(v) { this.attributes["id"] = String(v); }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k.indexOf("data-") === 0) this.dataset[camel(k.slice(5))] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(child) {
    if (child && child.nodeType === 11) {           /* fragment: move its children */
      child.childNodes.slice().forEach(c => this.appendChild(c));
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    const at = this.childNodes.indexOf(child);
    if (at >= 0) { this.childNodes.splice(at, 1); child.parentNode = null; }
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(other) {
    let n = other;
    while (n) { if (n === this) return true; n = n.parentNode; }
    return false;
  }
  get textContent() {
    if (this._text != null) return this._text;
    return this.childNodes.map(c => c.textContent).join("");
  }
  set textContent(v) {
    this.childNodes.slice().forEach(c => this.removeChild(c));
    if (v != null && v !== "") {
      const t = new Node("#text", this.ownerDocument);
      t.nodeType = 3; t._text = String(v);
      this.appendChild(t);
    }
  }
  get innerHTML() { return this._html == null ? "" : this._html; }
  set innerHTML(html) {
    this._html = String(html);
    this.childNodes.slice().forEach(c => this.removeChild(c));
    parseHTML(String(html), this.ownerDocument).forEach(n => this.appendChild(n));
  }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const list = this._listeners[type] || [];
    const at = list.indexOf(fn);
    if (at >= 0) list.splice(at, 1);
  }
  dispatchEvent(ev) {
    (this._listeners[ev.type] || []).slice().forEach(fn => fn.call(this, ev));
    return true;
  }
  click() { this.dispatchEvent({ type: "click", target: this, preventDefault() {} }); }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument && this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
  setSelectionRange() {}
  scrollIntoView() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
  /* --- selectors: #id, tag, .class, [attr], [attr="v"], and descendants --- */
  matches(sel) { return matchCompound(this, sel.trim()); }
  closest(sel) { let n = this; while (n) { if (n.nodeType === 1 && n.matches(sel)) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) {
    const out = [];
    String(sel).split(",").forEach(part => {
      const chain = part.trim().split(/\s+/);
      collect(this, chain, out);
    });
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function collect(root, chain, out) {
  const last = chain[chain.length - 1];
  walk(root, node => {
    if (node.nodeType !== 1 || !matchCompound(node, last)) return;
    let ok = true, n = node.parentNode;
    for (let i = chain.length - 2; i >= 0 && ok; i--) {
      let found = false;
      while (n) { if (n.nodeType === 1 && matchCompound(n, chain[i])) { found = true; n = n.parentNode; break; } n = n.parentNode; }
      ok = found;
    }
    if (ok && out.indexOf(node) < 0) out.push(node);
  });
}
function walk(node, fn) {
  node.childNodes.forEach(c => { fn(c); if (c.childNodes) walk(c, fn); });
}
function matchCompound(node, sel) {
  if (!sel) return false;
  const parts = sel.match(/^([a-zA-Z][\w-]*)?((?:[#.\[][^#.\[]*)*)$/);
  if (!parts) return false;
  if (parts[1] && node.tagName !== parts[1].toUpperCase()) return false;
  const rest = parts[2] || "";
  const tokens = rest.match(/[#.\[][^#.\[]*/g) || [];
  for (const t of tokens) {
    if (t[0] === "#") { if (node.id !== t.slice(1)) return false; }
    else if (t[0] === ".") { if (!node.classList.contains(t.slice(1))) return false; }
    else {
      const m = /^\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]?$/.exec(t.replace(/\]$/, "") + "]");
      if (!m) return false;
      const name = m[1];
      const want = m[2] != null ? m[2] : (m[3] != null ? m[3] : m[4]);
      const have = node.getAttribute(name) != null ? node.getAttribute(name)
                 : (node.dataset && node.dataset[camel(name.replace(/^data-/, ""))] != null && name.indexOf("data-") === 0
                    ? node.dataset[camel(name.slice(5))] : null);
      const val = have != null ? have : (node[name] != null ? String(node[name]) : null);
      if (val == null) return false;
      if (want != null && val !== want) return false;
    }
  }
  return true;
}

/* --- tiny HTML parser: tags, attributes, text, comments ------------------ */
function parseHTML(html, doc) {
  const out = [];
  const stack = [];
  const push = node => { (stack.length ? stack[stack.length - 1] : { appendChild: n => out.push(n) }).appendChild(node); };
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s">]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].indexOf("<!--") === 0) continue;
    if (m[1]) { if (stack.length) stack.pop(); continue; }
    if (m[2]) {
      const node = doc.createElement(m[2]);
      (m[3] || "").replace(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g, (all, name, dq, sq, bare) => {
        const value = dq != null ? dq : (sq != null ? sq : (bare != null ? bare : ""));
        node.setAttribute(name, decodeEntities(value));
        if (name === "hidden") node.hidden = true;
        if (name === "value") node.value = decodeEntities(value);
        if (name === "type") node.type = decodeEntities(value);
        if (name === "rows") node.rows = Number(value) || 0;
        return all;
      });
      push(node);
      if (!VOID.has(m[2].toLowerCase()) && !m[4]) stack.push(node);
      continue;
    }
    if (m[5] != null && m[5].trim() !== "") {
      const t = new Node("#text", doc);
      t.nodeType = 3; t._text = decodeEntities(m[5]);
      push(t);
    }
  }
  return out;
}

/* --- select.value falls back to the first option ------------------------- */
Object.defineProperty(Node.prototype, "value", {
  get() {
    if (this._value != null) return this._value;
    if (this.tagName === "SELECT") {
      const opt = this.querySelector("option");
      return opt ? (opt.value != null ? opt.value : opt.textContent) : "";
    }
    return "";
  },
  set(v) { this._value = v == null ? "" : String(v); },
  configurable: true
});

function makeDocument() {
  const doc = {
    activeElement: null,
    _listeners: {},
    createElement(tag) { return new Node(tag, doc); },
    createTextNode(text) { const t = new Node("#text", doc); t.nodeType = 3; t._text = String(text); return t; },
    createDocumentFragment() { const f = new Node("#fragment", doc); f.nodeType = 11; return f; },
    getElementById(id) { return doc.querySelector("#" + id); },
    querySelector(sel) { return doc.documentElement.querySelector(sel) || (doc.documentElement.matches(sel) ? doc.documentElement : null); },
    querySelectorAll(sel) { return doc.documentElement.querySelectorAll(sel); },
    addEventListener(type, fn) { (doc._listeners[type] = doc._listeners[type] || []).push(fn); },
    readyState: "complete"
  };
  doc.documentElement = new Node("html", doc);
  doc.body = new Node("body", doc);
  doc.head = new Node("head", doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  doc.activeElement = doc.body;
  return doc;
}

module.exports = { makeDocument, parseHTML, Node };
