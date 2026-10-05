import { ui } from "./ui.js";
import { titleOf } from "./types.js";

const api = window.apm;
const PREFS = "apm-desktop-prefs-v1";
const listeners = new Set();
const read = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

const DEFAULT_PREFS = { theme: "system", customThemes: [], sidebar: true, sounds: true, density: "comfortable", space: "all", sort: "recent", view: "vault", lastItem: null, showCli: true, receipts: true, vaults: {} };
const DEFAULT_SETTINGS = { sessionTimeout: "60", inactivity: "15", lockOnSleep: true, clipboard: "30", copyOnClick: true, confirmDelete: true, showTypeIcons: true, openOnLaunch: "all", siteIcons: "on" };

const freshSession = () => ({ unlocked: false, readonly: false, readonlyUntil: 0, unlockedAt: 0, lastActive: Date.now(), lockedAt: 0, lockReason: "" });

const S = {
  phase: "boot",
  fatal: null,
  info: null,
  status: null,
  disk: null,
  prefs: Object.assign({}, DEFAULT_PREFS, read(PREFS) || {}),
  session: freshSession(),
  pair: null,
  seen: null,
  busy: {},
  v: 0
};
const emit = () => { S.v++; listeners.forEach((l) => l()); };

export const store = {
  subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  get: () => S,
  emit,
  savePrefs: (p) => { S.prefs = Object.assign({}, S.prefs, p); write(PREFS, S.prefs); emit(); }
};

export function useStore(sel) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => store.subscribe(force), []);
  return sel ? sel(S) : S;
}

const hexOf = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
export const randHex = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return hexOf(a); };

const arr = (x) => (Array.isArray(x) ? x : []);
function normItem(it) {
  return Object.assign({ space: "", fav: false, f: {}, passkeys: [], created: 0, modified: 0, used: 0, uses: 0, rotated: 0, versions: [], createdBy: "", source: "", privilege: "", exposed: false }, it, { f: it.f || {}, passkeys: arr(it.passkeys), versions: arr(it.versions) });
}
function normalize(d) {
  const x = Object.assign({}, d);
  x.meta = Object.assign({ name: "Personal vault", path: "", created: 0, modified: 0, profile: "standard", custom: null, cipher: "AES-256-GCM", securityLevel: 1, alerts: false, alertEmail: "", anomaly: false, policy: null, activeSpace: "", version: "" }, d.meta || {});
  x.auth = Object.assign({ touchId: false, touchIdAvailable: false }, d.auth || {});
  x.items = arr(d.items).map(normItem);
  x.trash = arr(d.trash).map(normItem);
  x.spaces = arr(d.spaces).map((s) => Object.assign({ color: 0, created: 0 }, s, { id: s.id != null ? s.id : s.name }));
  x.audit = arr(d.audit);
  x.history = arr(d.history);
  x.commits = arr(d.commits);
  x.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  x.bridge = Object.assign({ token: "", port: 41417, running: false }, d.bridge || {});
  const r = d.recovery || {};
  x.recovery = Object.assign({ email: "", emailVerified: false, key: false, keyCreated: 0, codesCreated: 0, passkey: false, quorum: null }, r, { codes: r.codes && !Array.isArray(r.codes) ? r.codes : { total: arr(r.codes).length, unused: arr(r.codes).filter((c) => !c.used).length } });
  const sy = d.sync || {};
  x.sync = Object.assign({ auto: false, lastSync: 0, pending: false, ignore: "", ignorePath: "" }, sy, { providers: arr(sy.providers) });
  const m = d.mcp || {};
  x.mcp = Object.assign({ enabled: false, clients: {} }, m, { tokens: arr(m.tokens), tx: arr(m.tx), clients: m.clients || {} });
  x.sessions = arr(d.sessions);
  x.cliSession = d.cliSession || { active: false };
  x.policies = arr(d.policies);
  x.totpOrder = arr(d.totpOrder);
  x.newerFormat = d.newerFormat != null ? !!d.newerFormat : !!(S.status && S.status.newerFormat);
  x.readonly = !!d.readonly || x.newerFormat;
  return x;
}

function rememberVault() {
  const d = S.disk; const path = (S.status && S.status.path) || (d && d.meta.path);
  if (!d || !path) return;
  const cur = (S.prefs.vaults || {})[path] || {};
  if (cur.name === d.meta.name && cur.count === d.items.length) return;
  store.savePrefs({ vaults: Object.assign({}, S.prefs.vaults, { [path]: { name: d.meta.name, count: d.items.length } }) });
}

function setDisk(snap) {
  S.disk = normalize(snap);
  S.session.readonly = S.disk.readonly || (S.session.readonlyUntil > Date.now());
  rememberVault();
  emit();
}

export const NEWER_VAULT = "This vault was updated by a newer pm. Update APM to edit it.";

function friendly(e) {
  const code = e && e.code;
  if (code === "vault_newer") return NEWER_VAULT;
  if (code === "locked") return "The vault is locked.";
  if (code === "readonly") return "This session is read-only.";
  if (code === "network") return "Could not reach the provider. Check your connection and try again.";
  return (e && e.message) || "Something went wrong.";
}

async function call(method, params) {
  if (!api) throw Object.assign(new Error("The APM backend is not available."), { code: "internal" });
  try {
    const r = await api.call(method, params || {});
    if (r && r.snapshot) setDisk(r.snapshot);
    return r || {};
  } catch (e) {
    if (e && e.code === "locked" && S.session.unlocked) dropSession("expired");
    throw e;
  }
}

async function run(method, params, opts) {
  try {
    const r = await call(method, params);
    return Object.assign({ ok: true }, r);
  } catch (e) {
    const out = { ok: false, error: friendly(e), code: e && e.code, data: (e && e.data) || {} };
    if (!(opts && opts.quiet) && !(e && e.code === "locked")) ui.toast({ title: out.error, tone: "danger", icon: "triangle-alert", duration: 4200 });
    return out;
  }
}

function dropSession(reason) {
  const was = S.session.unlocked;
  if (was) play("lock");
  S.session = Object.assign(freshSession(), { lockedAt: Date.now(), lockReason: reason || "manual" });
  S.disk = null;
  ui.close(); ui.cmd(false); ui.quick(null); ui.edit(null); ui.setMulti([]);
  if (was) A.refreshStatus();
  emit();
}

const play = (name) => { if (!S.prefs.sounds) return; try { const a = new Audio("sounds/" + name + ".mp3"); a.volume = 0.45; a.play().catch(() => {}); } catch (e) {} };

async function loadSnapshot() {
  const r = await call("vault.snapshot");
  if (r && !r.snapshot && r.items) setDisk(r);
  return S.disk;
}

const byId = (id) => S.disk && (S.disk.items.find((x) => x.id === id) || S.disk.trash.find((x) => x.id === id));

const toMs = (t) => { const n = Number(t) || 0; return n && n < 1e12 ? n * 1000 : n; };
const normPair = (p) => (p && p.id ? { id: String(p.id), code: String(p.code || "").toUpperCase(), client: String(p.client || ""), expires: toMs(p.expires) } : null);
const newer = (a, b) => (!b || !b.ts || (a && a.ts >= toMs(b.ts)) ? a : { ts: toMs(b.ts), client: String(b.client || ""), origin: String(b.origin || "") });

function endPair(id, status) {
  const p = S.pair;
  if (!p || p.id !== id) return;
  S.pair = null;
  emit();
  const who = p.client || "Your browser";
  if (status === "approved") ui.toast({ title: who + " is connected", description: "It can fill from this vault while it is unlocked.", icon: "circle-check" });
  else if (status === "denied") ui.toast({ title: "Connection denied", description: who + " was not connected.", tone: "neutral", icon: "circle-x" });
  else if (status === "expired") ui.toast({ title: "Connection request expired", description: "Choose Connect in the extension to try again.", tone: "neutral", icon: "clock" });
}

export const A = {};

A.boot = async () => {
  if (!api) { S.phase = "fatal"; S.fatal = "The APM backend bridge is missing. Start the app with npm run dev."; emit(); return; }
  try {
    S.info = await api.app.info().catch(() => null);
    try { S.hello = await api.call("app.hello", {}); } catch (e) { S.hello = null; }
    const st = await call("vault.status");
    S.status = st;
    await A.bridgeInfo();
    if (st.unlocked) {
      if (await loadSnapshot()) S.session = Object.assign(freshSession(), { unlocked: true, unlockedAt: Date.now() });
    } else if (st.exists && st.cliSession) {
      try { await call("vault.unlockSession"); if (!S.disk) await loadSnapshot(); S.session = Object.assign(freshSession(), { unlocked: true, unlockedAt: Date.now() }); } catch (e) { S.disk = null; }
    }
    S.phase = "ready";
  } catch (e) {
    S.phase = "fatal"; S.fatal = friendly(e);
  }
  emit();
  api.on("vault.changed", (d) => { if (S.session.unlocked && d && d.snapshot) setDisk(d.snapshot); });
  api.on("vault.locked", (d) => { if (S.session.unlocked) { dropSession((d && d.reason) || "backend"); ui.toast({ title: "Vault locked", description: d && d.message ? d.message : null, tone: "neutral", icon: "lock" }); } });
  api.on("vault.unlocked", async (d) => {
    if (S.session.unlocked) { if (d && d.snapshot) setDisk(d.snapshot); return; }
    try { if (d && d.snapshot) setDisk(d.snapshot); else await loadSnapshot(); } catch (e) { return; }
    if (!S.disk || S.session.unlocked) return;
    A.enter();
    ui.toast({ title: "Unlocked from the browser", description: d && d.via === "browser-touchid" ? "With Touch ID" : null, tone: "neutral", icon: "lock-open" });
  });
  api.on("bridge.pair", (d) => { const p = normPair(d); if (!p) return; S.pair = p; emit(); });
  api.on("bridge.pairDone", (d) => { if (d && d.id) endPair(String(d.id), d.status); });
  api.on("bridge.activity", (d) => { A.activity(); const seen = newer(S.seen, d); if (seen !== S.seen) { S.seen = seen; emit(); } });
  api.on("mcp.pending", async (d) => {
    if (!S.session.unlocked) return;
    try { await loadSnapshot(); } catch (e) {}
    const tx = d && d.tx;
    if (tx) ui.toast({ title: (tx.client || "An assistant") + " is asking to " + (tx.op === "add_entry" ? "add an item" : tx.op === "delete_entry" ? "delete an item" : "change an item"), description: tx.summary, tone: "neutral", icon: "bot", duration: 7000, action: { label: "Review", onClick: () => ui.go({ view: "settings", section: "ai" }) } });
  });
  api.on("backend.exit", (d) => { S.phase = "fatal"; S.fatal = "The APM backend stopped" + (d && d.message ? ": " + d.message : ".") + " Restart the app."; S.disk = null; S.session = freshSession(); emit(); });
  api.on("power", (d) => { const st = S.disk && S.disk.settings; if (!S.session.unlocked || !st) return; if (st.lockOnSleep && d && (d.state === "suspend" || d.state === "lock-screen")) A.lock("sleep"); });
};

A.refreshStatus = async () => { try { S.status = await call("vault.status"); emit(); } catch (e) {} return S.status; };
A.hasVault = () => !!(S.status && S.status.exists);
A.lockInfo = () => {
  const st = S.status || {}; const cached = (S.prefs.vaults || {})[st.path] || {};
  return { name: cached.name || "Your vault", count: cached.count, path: st.path || "", profile: st.profile || null, touchId: !!(st.touchId && st.touchId.configured && st.touchId.available), recovery: st.recovery || {}, size: st.size || 0, modified: st.modified || 0 };
};

A.createVault = async (o) => {
  const r = await run("vault.setup", { password: o.password, name: o.name || "Personal vault", profile: o.profile, custom: o.custom || null, cipher: o.cipher, spaces: o.spaces || [], touchId: !!o.touchId, alerts: !!o.alerts, alertEmail: o.alertEmail || "" }, { quiet: true });
  if (!r.ok) return r;
  if (!S.disk) await loadSnapshot();
  await A.refreshStatus();
  S.session = Object.assign(freshSession(), { unlocked: !o.hold, unlockedAt: Date.now() });
  emit();
  return r;
};

A.unlock = async (password) => {
  try {
    await call("vault.unlock", { password });
    if (!S.disk) await loadSnapshot();
    return { ok: true };
  } catch (e) {
    const data = (e && e.data) || {};
    if (e.code === "wrong_password") return { ok: false, error: "wrong", left: data.left };
    if (e.code === "cooldown") return { ok: false, error: "cooldown", wait: data.wait || 30 };
    if (e.code === "breach_lock") return { ok: false, error: "breach", message: friendly(e) };
    return { ok: false, error: "other", message: friendly(e) };
  }
};
A.touchId = async () => {
  try { await call("vault.unlockTouchID"); if (!S.disk) await loadSnapshot(); return { ok: true }; }
  catch (e) { return { ok: false, code: e.code, message: friendly(e) }; }
};
A.enter = (opts) => {
  S.session = Object.assign(freshSession(), { unlocked: true, unlockedAt: Date.now(), lastActive: Date.now() });
  play("unlock");
  if (opts && opts.readonly) A.readonly(opts.readonly);
  emit();
};
A.lock = (reason) => {
  if (!S.session.unlocked && !S.disk) return;
  if (api) api.call("vault.lock", { reason: reason || "manual" }).catch(() => {});
  dropSession(reason);
};
A.activity = () => { S.session.lastActive = Date.now(); };
A.readonly = async (mins) => {
  const r = await run("vault.readonly", { minutes: mins });
  if (r.ok) { S.session.readonly = true; S.session.readonlyUntil = Date.now() + mins * 60000; emit(); }
  return r;
};
A.endReadonly = async () => {
  const r = await run("vault.readonly", { minutes: 0 });
  if (r.ok) { S.session.readonly = !!(S.disk && S.disk.readonly); S.session.readonlyUntil = 0; emit(); }
  return r;
};

A.addItem = async (item) => {
  const r = await run("item.add", { type: item.type, space: item.space || "", f: item.f || {}, fav: !!item.fav }, { quiet: true });
  if (!r.ok) return r;
  return { ok: true, item: r.item || { id: "", type: item.type, f: item.f, space: item.space || "" } };
};
A.updateItem = async (id, patch, note) => {
  const it = byId(id); if (!it) return { ok: false, error: "That item no longer exists." };
  const f = Object.assign({}, it.f, (patch && patch.f) || {});
  const space = patch && patch.space !== undefined ? patch.space : it.space || "";
  const r = await run("item.update", { id, f, space, note: note || "" });
  if (r.ok && r.item && ui.get().selected === id) ui.select(r.item.id);
  return r;
};
A.patchMeta = (id, patch) => run("item.meta", Object.assign({ id }, patch));
A.used = (id) => { if (api && S.session.unlocked && !S.session.readonly) api.call("item.used", { id }).then((r) => { if (r && r.snapshot) setDisk(r.snapshot); }).catch(() => {}); };
A.duplicate = async (id) => { const r = await run("item.duplicate", { id }); return r.ok ? r.item : null; };
A.deleteItems = async (ids) => {
  const gone = ids.map(byId).filter(Boolean);
  const r = await run("item.delete", { ids });
  if (!r.ok) return [];
  const trash = (S.disk && S.disk.trash) || [];
  const taken = new Set();
  return gone.map((g) => {
    const t = trash.filter((x) => !taken.has(x.id) && x.type === g.type && (x.space || "") === (g.space || "") && titleOf(x) === titleOf(g)).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))[0];
    if (t) taken.add(t.id);
    return Object.assign({}, g, { trashId: t ? t.id : null });
  });
};
A.restoreItems = async (ids) => { const back = ids.map(byId).filter(Boolean); const r = await run("item.restore", { ids }); return r.ok ? back : []; };
A.purge = (ids) => run("item.purge", { ids });
A.emptyTrash = async () => { const n = S.disk ? S.disk.trash.length : 0; const r = await run("trash.empty"); return r.ok ? n : 0; };
A.moveItems = (ids, space) => run("item.move", { ids, space: space || "" });
A.favItems = (ids, on) => run("item.favorite", { ids, on: !!on });
A.restoreVersion = (id, index) => run("item.restoreVersion", { id, index });
A.useCode = (id, code) => run("item.useCode", { id, code });
A.itemFile = async (id) => { try { return await call("item.file", { id }); } catch (e) { ui.toast({ title: friendly(e), tone: "danger" }); return null; } };
A.saveItemFile = async (id, name) => {
  const path = await api.dialog.save({ title: "Save a copy", defaultPath: name || "file" });
  if (!path) return { ok: false, cancelled: true };
  const r = await run("item.saveFile", { id, path });
  if (r.ok) ui.toast({ title: "Saved " + path.split(/[\\/]/).pop(), icon: "download", action: { label: "Show", onClick: () => api.shell.showItemInFolder(path) } });
  return r;
};
A.importItems = async (items) => run("item.import", { items: items.map((x) => ({ type: x.type, space: x.space || "", f: x.f })) });
A.totpOrder = (ids) => run("totp.order", { ids }, { quiet: true });

A.addSpace = async (name) => {
  const n = String(name || "").trim(); if (!n) return { ok: false, error: "Give the space a name." };
  const r = await run("space.add", { name: n }, { quiet: true });
  return r.ok ? { ok: true, space: { id: n, name: n } } : r;
};
A.renameSpace = (id, name) => run("space.rename", { id, name: String(name || "").trim() }, { quiet: true });
A.deleteSpace = (id, moveTo) => run("space.delete", { id, moveTo: moveTo || "" });
A.spaceColor = (id, color) => run("space.color", { id, color });

A.settings = (patch) => run("vault.settings", { patch });
A.meta = (patch) => run("vault.meta", patch);
A.setProfile = (profile, custom, cipher) => run("security.profile", { profile, custom: custom || null, cipher: cipher || "" }, { quiet: true });
A.changePassword = async (current, next) => {
  const r = await run("security.changePassword", { current, next }, { quiet: true });
  if (!r.ok && r.code === "wrong_password") return { ok: false, error: "That is not your current master password." };
  return r;
};
A.touchIdSet = async (on, password) => {
  const r = await run("security.touchId", { on: !!on, password: password || "" }, { quiet: true });
  if (!r.ok && r.code === "wrong_password") return { ok: false, error: "That is not your master password." };
  if (!r.ok && r.code === "touchid_unavailable") return { ok: false, error: "Touch ID is not available on this Mac." };
  await A.refreshStatus();
  return r;
};
A.policy = (name) => (name ? run("policy.load", { name }) : run("policy.clear"));

A.recoveryEmailStart = (email) => run("recovery.email.start", { email }, { quiet: true });
A.recoveryEmailVerify = (code) => run("recovery.email.verify", { code }, { quiet: true });
A.newRecoveryKey = async () => { const r = await run("recovery.key.create"); return r.ok ? r.key : null; };
A.newCodes = async (count) => { const r = await run("recovery.codes.generate", { count }); return r.ok ? r.codes : null; };
A.recoveryPasskey = (on) => run(on ? "recovery.passkey.register" : "recovery.passkey.remove", {}, { quiet: true });
A.newQuorum = (threshold, shares, key) => run("recovery.quorum.setup", { threshold, shares, key: key || "" }, { quiet: true });
A.resetRecovery = () => run("recovery.reset");

A.recoverStart = () => run("recover.start", {}, { quiet: true });
A.recoverEmailSend = (email) => run("recover.email.send", { email }, { quiet: true });
A.recoverEmailVerify = (code) => run("recover.email.verify", { code }, { quiet: true });
A.recoverVerify = (method, value, shares, email) => run("recover.verify", { method, value: value || "", shares: shares || [], email: email || "" }, { quiet: true });
A.recoverReset = async (password) => { const r = await run("recover.reset", { password }, { quiet: true }); if (r.ok) { if (!S.disk) await loadSnapshot(); await A.refreshStatus(); } return r; };

A.undo = (steps) => run("lgit.undo", { steps: steps || 1 }, { quiet: true });
A.checkout = (id) => run("lgit.checkout", { id }, { quiet: true });
A.squash = (keep) => run("lgit.squash", { keep });
A.prune = () => run("lgit.prune");
A.verify = () => run("lgit.verify", {}, { quiet: true });

A.passkeyRemove = (credentialId) => run("passkey.remove", { credentialId });
A.passkeyRename = (credentialId, label) => run("passkey.rename", { credentialId, label: String(label || "").trim().slice(0, 120) });
A.bridgeRotate = () => run("bridge.rotate");
A.iconsGet = (hosts) => call("icons.get", { hosts });
A.iconsClear = () => run("icons.clear", {}, { quiet: true });
A.on = (event, cb) => (api && api.on ? api.on(event, cb) : () => {});
A.bridgeInfo = async () => {
  try {
    const r = await call("bridge.info");
    S.seen = newer(S.seen, r.lastSeen);
    if (!S.pair && r.pair) S.pair = normPair(r.pair);
    emit();
    return r;
  } catch (e) { return null; }
};
A.pairRespond = async (id, allow) => {
  const r = await run("bridge.pairRespond", { id: String(id), allow: !!allow }, { quiet: true });
  if (r.ok) endPair(id, r.status || (allow ? "approved" : "denied"));
  else if (["not_found", "pair_expired", "pair_denied"].includes(r.code)) endPair(id, "expired");
  else ui.toast({ title: r.error, tone: "danger", icon: "triangle-alert", duration: 4200 });
  return r;
};
A.pairExpire = (id) => endPair(id, "expired");
A.bridgeSeen = () => newer(S.seen, S.disk && S.disk.bridge.lastSeen);

A.syncConnect = (p) => run("sync.connect", p, { quiet: true });
A.syncDisconnect = (provider) => run("sync.disconnect", { provider });
A.syncNow = async (provider) => {
  const list = S.disk ? S.disk.sync.providers.filter((p) => p.connected && (!provider || p.id === provider)) : [];
  if (!list.length) return 0;
  S.busy.sync = true; emit();
  const r = await run("sync.now", provider ? { provider } : {});
  S.busy.sync = false; emit();
  return r.ok ? (r.count != null ? r.count : list.length) : 0;
};
A.syncDiff = (provider) => run("sync.diff", { provider }, { quiet: true });
A.syncApply = (provider, selected) => run("sync.apply", { provider, selected });
A.syncIgnore = (text) => run("sync.ignore", { text });
A.syncAuto = (on) => run("sync.auto", { on: !!on });
A.syncRestore = async (p) => {
  S.disk = null;
  const r = await run("sync.restore", Object.assign({ overwrite: false }, p), { quiet: true });
  if (r.ok) { if (!S.disk) await loadSnapshot(); await A.refreshStatus(); }
  return r;
};

A.mcpEnabled = (on) => run("mcp.enabled", { on: !!on });
A.mcpClient = (name, on) => run("mcp.client", { name, on: !!on });
A.tokenCreate = (name, perms, expiresMinutes) => run("mcp.token.create", { name, perms, expiresMinutes }, { quiet: true });
A.tokenRevoke = (id) => run("mcp.token.revoke", { id });
A.txApprove = (id) => run("mcp.tx.approve", { id });
A.txAbort = (id) => run("mcp.tx.abort", { id });
A.mcpConfig = (client, token) => run("mcp.config", { client, token }, { quiet: true });

A.sessionIssue = (o) => run("sessions.issue", o, { quiet: true });
A.sessionRevoke = (id) => run("sessions.revoke", { id });

A.exportData = (o) => run("data.export", o, { quiet: true });
A.importData = (o) => run("data.import", o, { quiet: true });
A.transferFormats = () => run("transfer.formats", {}, { quiet: true });
A.transferPreview = (o) => run("transfer.preview", o, { quiet: true });
A.transferPlan = (token, space, keepSpaces) => run("transfer.plan", { token, space: space || "", keepSpaces: !!keepSpaces }, { quiet: true });
A.transferApply = (token, space, keepSpaces, decisions) => run("transfer.apply", { token, space: space || "", keepSpaces: !!keepSpaces, decisions: decisions || {} }, { quiet: true });
A.transferDiscard = (token) => { if (token && api && S.session.unlocked) api.call("transfer.discard", { token }).catch(() => {}); };
A.transferCompare = (o) => run("transfer.compare", o, { quiet: true });
A.exportPreview = (o) => run("transfer.exportPreview", o, { quiet: true });
A.exportFile = (o) => run("transfer.export", o, { quiet: true });
A.backup = async () => {
  const name = "vault-" + new Date().toISOString().slice(0, 10) + ".dat";
  const path = await api.dialog.save({ title: "Save an encrypted backup", defaultPath: name, filters: [{ name: "APM vault", extensions: ["dat"] }] });
  if (!path) return { ok: false, cancelled: true };
  const r = await run("vault.backup", { path });
  if (r.ok) ui.toast({ title: "Backup saved", description: path.split(/[\\/]/).pop(), icon: "download", action: { label: "Show", onClick: () => api.shell.showItemInFolder(path) } });
  return r;
};
A.cleanupScan = () => run("cleanup.scan", {}, { quiet: true });
A.cleanupApply = (ids) => run("cleanup.apply", { ids });
A.audit = (action, details) => { if (api && S.session.unlocked) api.call("audit.log", { action, details: details || "" }).then((r) => { if (r && r.snapshot) setDisk(r.snapshot); }).catch(() => {}); };
A.destroy = async (confirm) => {
  const r = await run("vault.destroy", { confirm }, { quiet: true });
  if (r.ok) { S.session = freshSession(); S.disk = null; await A.refreshStatus(); emit(); }
  return r;
};

A.copyValue = (text, clearAfter) => {
  const v = String(text == null ? "" : text);
  if (api && api.clipboard) return api.clipboard.write(v, { clearAfter: Number(clearAfter) || 0 }).catch(() => {});
  try { return navigator.clipboard.writeText(v).catch(() => {}); } catch (e) { return Promise.resolve(); }
};

export function audit(action, details) { A.audit(action, details); }
