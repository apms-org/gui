import { A as act } from "./store.js";
import { ui, openUrl } from "./ui.js";
import { getType, passwordKey } from "./types.js";

// Watchtower and Activity state. pm runs every check (watchtower.scan,
// activity.list); this module keeps the last answer and rescans when asked.

const W = { report: null, scanning: false, error: null, unsupported: false, activity: null, unack: 0, activityUnsupported: false, v: 0 };
const subs = new Set();
const emit = () => { W.v++; subs.forEach((l) => l()); };

export function useWt() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { subs.add(force); return () => subs.delete(force); }, []);
  return W;
}

export const OLD_PM = "This version of pm can't run these checks. Update pm and try again.";
const arr = (x) => (Array.isArray(x) ? x : []);
const ms = (t) => { const n = Number(t) || 0; return n && n < 1e12 ? n * 1000 : n; };
export const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
export const SEV_TONE = { critical: "danger", high: "warning", medium: "warning", low: "neutral" };
export const LEVEL_TONE = { low: "neutral", medium: "warning", high: "warning", critical: "danger" };
export const LEVEL_LABEL = { low: "Low risk", medium: "Medium risk", high: "High risk", critical: "Critical" };
const sevOf = (s) => (SEV_RANK[s] ? s : "medium");

function normReport(r) {
  const b = r.breach || {};
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
    grade: String(r.grade || ""),
    generated: ms(r.generated) || Date.now(),
    itemsChecked: Number(r.itemsChecked) || 0,
    categories: arr(r.categories).map((c) => ({ kind: String(c.kind || ""), label: String(c.label || c.kind || ""), count: Number(c.count) || 0, severity: sevOf(c.severity) })),
    findings: arr(r.findings).filter((f) => f && f.id).map((f) => Object.assign({}, f, {
      severity: sevOf(f.severity), impact: Number(f.impact) || 0, fixes: arr(f.fixes), itemId: f.itemId || "", space: f.space && String(f.space).toLowerCase() !== "default" ? String(f.space) : "",
      dismissed: f.dismissed ? { reason: String(f.dismissed.reason || ""), at: ms(f.dismissed.at), until: ms(f.dismissed.until) } : null
    })),
    setup: arr(r.setup).map((x) => ({ id: String(x.id || ""), label: String(x.label || ""), ok: !!x.ok, detail: String(x.detail || ""), fix: String(x.fix || "") })),
    trust: arr(r.trust).map((t) => ({ itemId: t.itemId || "", score: Number(t.score) || 0, level: LEVEL_TONE[t.level] ? t.level : "medium", reasons: arr(t.reasons).map((x) => ({ text: String(x.text || ""), delta: Number(x.delta) || 0 })) })),
    history: arr(r.history).map((h) => ({ t: ms(h.t), score: Number(h.score) || 0 })).filter((h) => h.t),
    trend: r.trend && isFinite(Number(r.trend.delta)) ? { delta: Math.round(Number(r.trend.delta)), since: ms(r.trend.since) } : null,
    breach: { enabled: !!b.enabled, lastChecked: ms(b.lastChecked), checked: Number(b.checked) || 0, found: Number(b.found) || 0 }
  };
}

const normEvent = (e) => Object.assign({}, e, { id: String(e.id || ""), severity: sevOf(e.severity), at: ms(e.at), acknowledged: !!e.acknowledged, title: String(e.title || ""), body: String(e.body || "") });

let seq = 0;
let timer = null;
let space = "";
async function doScan() {
  const my = ++seq;
  W.scanning = true; emit();
  const r = await act.wtScan(space);
  if (my !== seq) return r;
  W.scanning = false;
  if (r.ok) { W.report = normReport(r); W.error = null; W.unsupported = false; }
  else { W.unsupported = r.code === "unsupported"; W.error = W.unsupported ? OLD_PM : r.error; }
  emit();
  return r;
}

async function loadActivity() {
  const r = await act.activityList();
  if (r.ok) {
    W.activity = arr(r.events).map(normEvent).filter((e) => e.id).sort((a, b) => b.at - a.at);
    W.unack = r.unacknowledged != null ? Number(r.unacknowledged) || 0 : W.activity.filter((e) => !e.acknowledged).length;
    W.activityUnsupported = false;
  } else if (r.code === "unsupported") { W.activity = []; W.unack = 0; W.activityUnsupported = true; }
  emit();
  return r;
}

// The sidebar's space: "all" scans everything, "" is the Default space.
const spaceParam = (s) => (s === "all" || s == null ? "" : s === "" ? "default" : s);
const failed = (r, fallback) => { ui.toast({ title: r.code === "unsupported" ? OLD_PM : r.error || fallback, tone: "danger", icon: "triangle-alert", duration: 4200 }); return r; };

export const wt = {
  get: () => W,
  // Debounced so a burst of vault.changed events runs one scan.
  scan: (s) => { space = spaceParam(s); clearTimeout(timer); timer = setTimeout(() => { doScan(); loadActivity(); }, 150); },
  rescan: () => { clearTimeout(timer); return doScan(); },
  activity: loadActivity,
  reset: () => { clearTimeout(timer); seq++; Object.assign(W, { report: null, scanning: false, error: null, unsupported: false, activity: null, unack: 0, activityUnsupported: false }); emit(); },
  dismiss: async (id, reason, days) => { const r = await act.wtDismiss(id, reason, days); if (!r.ok) return failed(r, "Could not dismiss it."); await doScan(); return r; },
  restore: async (id) => { const r = await act.wtRestore(id); if (!r.ok) return failed(r, "Could not restore it."); await doScan(); return r; },
  breach: async (on) => { const r = await act.wtBreach(on); if (!r.ok) return failed(r, "Could not change breach check."); await doScan(); return r; },
  breachCheck: async () => {
    const r = await act.wtBreachCheck();
    if (!r.ok) return failed(r, "Breach check failed.");
    if (r.findings || r.score != null) { seq++; W.report = normReport(r); W.error = null; emit(); } else await doScan();
    return r;
  },
  markExposed: async (id, on) => { const r = await act.markExposed(id, on); if (!r.ok) return failed(r, "Could not change the flag."); await doScan(); return r; },
  ack: async (id) => { const r = await act.activityAck(id); if (!r.ok) return failed(r, "Could not acknowledge it."); await loadActivity(); return r; },
  ackAll: async () => { const r = await act.activityAckAll(); if (!r.ok) return failed(r, "Could not acknowledge them."); await loadActivity(); return r; }
};

// Items that need attention, the same number as the Fix these first tab, and
// whether any of them is critical. Unacknowledged activity is kept apart so
// the sidebar can show it as a dot instead of adding it in.
export function attention(w) {
  const rows = w.report ? rowsOf(w.report, {}) : [];
  const events = w.activity ? w.activity.filter((e) => !e.acknowledged) : [];
  return { count: rows.length, critical: rows.some((r) => r.findings.some((f) => f.severity === "critical")), activity: w.unack || 0, activityCritical: events.some((e) => e.severity === "critical") };
}

export function findingsFor(w, itemId) {
  return w.report ? w.report.findings.filter((f) => f.itemId === itemId && !f.dismissed).sort((a, b) => b.impact - a.impact || SEV_RANK[b.severity] - SEV_RANK[a.severity]) : [];
}

export function trustFor(w, itemId) {
  return w.report ? w.report.trust.find((t) => t.itemId === itemId) || null : null;
}

// One row per item: every problem it has, the points fixing them brings back,
// sorted biggest first. Vault-level findings without an item share one row;
// setup checks have their own section.
export function rowsOf(report, opts) {
  const o = opts || {};
  const rows = new Map();
  report.findings.forEach((f) => {
    if (f.kind === "setup") return;
    if (!o.showDismissed && f.dismissed) return;
    if (o.kind && f.kind !== o.kind) return;
    if (o.space != null && o.space !== "all" && f.itemId && f.space !== o.space) return;
    const key = f.itemId || "vault";
    const row = rows.get(key) || { key, itemId: f.itemId, title: f.itemTitle || "", type: f.itemType || "", space: f.space, findings: [], impact: 0, rank: 0 };
    row.findings.push(f);
    if (!f.dismissed) { row.impact += f.impact; row.rank = Math.max(row.rank, SEV_RANK[f.severity]); }
    rows.set(key, row);
  });
  const out = Array.from(rows.values());
  out.forEach((r) => { r.dismissed = r.findings.every((f) => f.dismissed); r.findings.sort((a, b) => !!a.dismissed - !!b.dismissed || b.impact - a.impact || SEV_RANK[b.severity] - SEV_RANK[a.severity]); });
  return out.sort((a, b) => a.dismissed - b.dismissed || b.impact - a.impact || b.rank - a.rank || a.title.localeCompare(b.title));
}

// One step per fix: an item's open findings grouped by the fix that clears
// them (the first in fixes), the step worth the most first.
export function stepsOf(findings) {
  const m = new Map();
  findings.forEach((f) => {
    const fix = f.fixes[0] || "";
    const s = m.get(fix) || { fix, fixes: [], findings: [], impact: 0, rank: 0 };
    s.findings.push(f);
    s.impact += f.impact;
    s.rank = Math.max(s.rank, SEV_RANK[f.severity]);
    f.fixes.forEach((x) => { if (!s.fixes.includes(x)) s.fixes.push(x); });
    m.set(fix, s);
  });
  const out = Array.from(m.values());
  out.forEach((s) => s.findings.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.impact - a.impact));
  return out.sort((a, b) => b.impact - a.impact || b.rank - a.rank);
}

export const firstSentence = (s) => { const t = String(s || "").trim(); const m = t.match(/^.+?[.!?](?=\s+[A-Z0-9"“])/); return m ? m[0] : t; };

// Why each kind of problem matters, in plain words. pm can send its own.
export const WHY = {
  weak: "Short or common passwords are the first ones tried when someone guesses. A long random one isn't worth guessing.",
  reused: "If any one of these sites leaks, the same password opens all the others.",
  old: "The longer a password stays the same, the more chances it has had to leak somewhere.",
  exposed: "You marked this as leaked. Anyone who saw it can still use it until you change it.",
  breached: "This password is on public lists of leaked passwords, which are tried first in attacks.",
  expiring: "When it expires, whatever it unlocks stops working, usually when you need it.",
  insecure_url: "A site without https sends what you type in a way others on the network can read.",
  no_2fa: "With a second step, a stolen password alone isn't enough to sign in.",
  passkey_available: "A passkey can't be phished, guessed or reused, and there is nothing to remember.",
  ssh_key: "Old or short keys are easier to break, and a key that never changes is hard to take back.",
  certificate: "An expired or weak certificate breaks connections or lets someone pretend to be the server.",
  wifi: "Older Wi-Fi security can be broken from outside, which lets others onto your network.",
  recovery_codes: "Recovery codes get you in without your second step. Keep them current or you could be locked out.",
  api_key: "A key that never changes keeps working for anyone who finds it in a log, a script or a repo.",
  setup: "This protects the whole vault, not just one item."
};

const SETTINGS_FIX = {
  recovery: { label: "Set up recovery", go: { view: "settings", section: "recovery" } },
  alerts: { label: "Turn on alerts", go: { view: "settings", section: "alerts" } },
  autolock: { label: "Set auto-lock", go: { view: "settings", section: "sessions" } },
  touchid: { label: "Set up Touch ID", go: { view: "settings", section: "security" } },
  profile: { label: "Change profile", go: { view: "settings", section: "security" } },
  ai: { label: "Review MCP", go: { view: "settings", section: "ai" } },
  breach: { label: "Turn on breach check", go: { view: "watchtower", tab: "setup" }, anchor: "wt-breach" },
  audit: { label: "Open history", go: { view: "history" } }
};
const FIX_TITLE = { change_password: "Change the password", open_change_url: "Open the change page", rotate: "Rotate it", clear_exposed: "Clear the exposed flag", enable_2fa: "Turn on two-factor", add_passkey: "Add a passkey", replace_key: "Replace the key", renew: "Renew it", edit_item: "Edit the item" };
// Why a step matters, one sentence per fix. Fixes left out here use pm's own
// reason for the problem when the step has one kind of problem.
const FIX_WHY = {
  change_password: "Attackers try guessable, leaked and reused passwords first, and a new random one is none of those.",
  rotate: "Anyone who has the old secret keeps access until you replace it with a new random one.",
  clear_exposed: "Clear it once the secret has changed, so Watchtower stops counting it.",
  enable_2fa: "With a code, someone who has the password still can't sign in.",
  add_passkey: "",
  replace_key: "A new key cuts off anyone who copied the old one, and old or short keys are easier to break.",
  renew: "Expired cards, keys and certificates stop working, often right when you need them."
};
const FIX_LABEL = { change_password: "Change password", open_change_url: "Open change page", rotate: "Rotate", clear_exposed: "Clear exposed flag", enable_2fa: "Add 2FA", add_passkey: "Add a passkey", replace_key: "Replace key", renew: "Renew", edit_item: "Edit item" };
const FIX_ICON = { change_password: "key-round", open_change_url: "external-link", rotate: "refresh-cw", clear_exposed: "eraser", enable_2fa: "timer", add_passkey: "fingerprint", replace_key: "key-round", renew: "calendar", edit_item: "pencil" };

export const fixLabel = (id) => (String(id).startsWith("settings:") ? (SETTINGS_FIX[id.slice(9)] || { label: "Open settings" }).label : FIX_LABEL[id] || "Open item");
export const fixTitle = (id) => (String(id).startsWith("settings:") ? "Open settings" : FIX_TITLE[id] || "Review the item");
export function whyOf(step) {
  if (Object.prototype.hasOwnProperty.call(FIX_WHY, step.fix)) return FIX_WHY[step.fix];
  const f = step.findings[0];
  if (!f || step.findings.some((x) => x.kind !== f.kind)) return "";
  return f.why || WHY[f.kind] || "";
}
export const fixIcon = (id) => (String(id).startsWith("settings:") ? "settings" : FIX_ICON[id] || "arrow-up-right");

// Opens an item in the vault, in the editor at one field when asked.
export function openItem(id, focus) {
  ui.go({ view: "vault", filter: "all" }); ui.query(""); ui.select(id);
  if (focus) ui.edit(id, focus === true ? null : focus);
}

export function goSettings(id) {
  const s = SETTINGS_FIX[id];
  if (!s) { ui.go({ view: "settings", section: id || "general" }); return; }
  ui.go(s.go);
  if (s.anchor) setTimeout(() => { const el = document.getElementById(s.anchor); if (el) { el.scrollIntoView({ block: "start", behavior: "smooth" }); const b = el.querySelector("button,[role=switch],input"); b && b.focus({ preventScroll: true }); } }, 80);
}

// Runs one fix from a finding. item is the vault item when there is one.
export async function runFix(fix, f, item) {
  if (String(fix).startsWith("settings:")) { goSettings(fix.slice(9)); return; }
  const id = (item && item.id) || f.itemId;
  const t = item ? getType(item.type) : null;
  if (fix === "open_change_url") { openUrl(f.changeUrl || f.url); return; }
  if (fix === "clear_exposed") { const r = await wt.markExposed(id, false); if (r.ok) ui.toast({ title: "Cleared the exposed flag", description: f.itemTitle || null }); return; }
  if (!id) return;
  if (fix === "change_password") { openItem(id, { field: (item && passwordKey(item.type)) || "password", generate: true }); return; }
  if (fix === "enable_2fa") { openItem(id, item && item.type === "password" ? { field: "totp" } : null); return; }
  if (fix === "add_passkey") { openItem(id, item && item.type === "password" ? { field: "passkeys" } : null); return; }
  if (fix === "renew") { const d = t && t.fields.find((x) => x.kind === "date"); openItem(id, d ? { field: d.key } : true); return; }
  if (fix === "rotate" || fix === "replace_key") { openItem(id, t && t.primary ? { field: t.primary, generate: fix === "rotate" && !!passwordKey(item.type) } : true); return; }
  if (fix === "edit_item") { openItem(id, true); return; }
  openItem(id);
}
