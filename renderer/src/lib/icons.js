import { store, A as act } from "./store.js";

const MAX = 300;
const RETRY_MS = 30000;
const IPV4 = /^\d+(\.\d+){3}$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

export function hostOf(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return "";
  let u;
  try { u = new URL(SCHEME.test(s) ? s : "https://" + s); } catch (e) { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  let host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.startsWith("[") || host.includes(":")) return "";
  host = host.replace(/^www\./, "");
  if (!host.includes(".") || IPV4.test(host)) return "";
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return "";
  return host;
}

export function iconKey(it) {
  const f = (it && it.f) || {};
  const urls = Array.isArray(f.urls) ? f.urls : f.urls ? [f.urls] : [];
  const first = String(f.website || "").trim() || String(urls.find((x) => String(x || "").trim()) || "").trim() || (it && it.type === "totp" ? String(f.domain || "").trim() : "");
  return hostOf(first);
}

const cache = new Map();
const waiting = new Set();
const failed = new Map();
const queue = new Set();
const listeners = new Set();
let timer = null;
let unsupported = false;
let bound = false;
let unlocked = false;
let gen = 0;

const notify = () => listeners.forEach((l) => l());

const isUnsupported = (e) => {
  const code = String((e && e.code) || "");
  return code === "unsupported" || code === "method_not_found" || code === "-32601" || /unknown method|method not found/i.test(String((e && e.message) || ""));
};

export function iconsEnabled() {
  const d = store.get().disk;
  const v = d && d.settings ? d.settings.siteIcons : "on";
  return v !== "off" && v !== false;
}

function reset() {
  cache.clear(); waiting.clear(); failed.clear(); queue.clear();
  clearTimeout(timer); timer = null;
  unsupported = false;
  gen++;
}

function bind() {
  if (bound) return;
  bound = true;
  unlocked = !!store.get().session.unlocked;
  act.on("icons.updated", (d) => {
    const hosts = Array.isArray(d && d.hosts) ? d.hosts : [];
    let hit = false;
    for (const raw of hosts) {
      const h = String(raw || "").toLowerCase();
      if (!waiting.has(h) && !cache.has(h)) continue;
      waiting.delete(h); cache.delete(h); failed.delete(h);
      queue.add(h); hit = true;
    }
    if (hit) schedule();
  });
  store.subscribe(() => {
    const now = !!store.get().session.unlocked;
    if (now === unlocked) return;
    unlocked = now;
    reset();
    notify();
  });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 24);
}

async function flush() {
  timer = null;
  if (unsupported || !queue.size) { queue.clear(); return; }
  const all = Array.from(queue);
  queue.clear();
  for (let i = 0; i < all.length; i += MAX) await fetchBatch(all.slice(i, i + MAX));
}

async function fetchBatch(hosts) {
  hosts.forEach((h) => waiting.add(h));
  const g = gen;
  let r;
  try {
    r = await act.iconsGet(hosts);
  } catch (e) {
    if (g !== gen) return;
    hosts.forEach((h) => waiting.delete(h));
    if (isUnsupported(e)) unsupported = true;
    else hosts.forEach((h) => failed.set(h, Date.now()));
    return;
  }
  if (g !== gen) return;
  const icons = (r && r.icons) || {};
  const pending = new Set(Array.isArray(r && r.pending) ? r.pending.map((h) => String(h).toLowerCase()) : []);
  let changed = false;
  for (const h of hosts) {
    if (pending.has(h)) continue;
    waiting.delete(h);
    const v = icons[h];
    const src = typeof v === "string" && /^data:image\//i.test(v) ? v : null;
    if (cache.get(h) !== src) changed = true;
    cache.set(h, src);
  }
  if (changed) notify();
}

function want(host) {
  if (unsupported || cache.has(host) || waiting.has(host) || queue.has(host)) return;
  const at = failed.get(host);
  if (at && Date.now() - at < RETRY_MS) return;
  queue.add(host);
  schedule();
}

export function iconFor(it) {
  if (!it || !iconsEnabled()) return undefined;
  const host = iconKey(it);
  if (!host) return undefined;
  bind();
  const v = cache.get(host);
  if (v === undefined) want(host);
  return v || undefined;
}

export function useIcons() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { listeners.add(force); return () => listeners.delete(force); }, []);
}

export function useIcon(it) {
  useIcons();
  return iconFor(it);
}

export async function clearIcons() {
  const r = await act.iconsClear();
  if (r.ok) { reset(); notify(); }
  return Object.assign({}, r, { unsupported: !r.ok && isUnsupported({ code: r.code, message: r.error }) });
}

export const iconsState = () => ({ cached: cache.size, waiting: waiting.size, unsupported });
