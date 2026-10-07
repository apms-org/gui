"use strict";

// The system-wide approval prompt for MCP write requests.
//
// pm desktop announces each pending request with mcp.pending and its end with
// mcp.resolved. This keeps them in a queue, oldest first, and shows the oldest
// in a small always-on-top panel (renderer/approval.html) that floats over
// every Space and full-screen app without activating APM. The renderer only
// gets the narrow window.apmApproval API from approval-preload.js, and every
// message it sends is checked here: a decision is forwarded to pm only for the
// request on screen.
//
// Touch ID runs inline, like the lock screen: native/touchid.mm draws macOS's
// own glyph over the sheet's glyph slot. LocalAuthentication cancels a check
// at once when the app asking isn't the active one, so the panel activates
// APM when it shows (only while no other APM window is on screen, which
// activation would bring forward) and again whenever the system cancels a
// check while the panel is key.

const { codeFor, validSlot } = require("./touchid");

const WIDTH = 448; // 400 px sheet + a 24 px shadow margin on each side
const MAX_HEIGHT = 2000;
const TOP_RATIO = 0.12;
const MAX_FAILS = 3;
const REARM_MS = 600;
const REARM_MAX_MS = 5000; // the slowest re-arm while the system keeps cancelling
// LAError codes for a check the system or app called off (not a wrong finger).
const LA_CANCELS = new Set([-2, -4, -9, -1004]);
const LEAVE_FALLBACK_MS = 4000;
const SYNC_TRIES = 20;
const SYNC_DELAY_MS = 300;
const ID_RE = /^tx_[0-9a-f]+$/;
const VIAS = new Set(["touchid", "click", "keyboard"]);

function validId(id) {
  return typeof id === "string" && id.length <= 128 && ID_RE.test(id);
}

function invalid(message) {
  return { ok: false, error: { code: "invalid", message } };
}

// Checks a decide() call from the renderer. Returns an error message or null.
function checkDecision(id, approve, via) {
  if (!validId(id)) return "That is not a request id.";
  if (typeof approve !== "boolean") return "approve must be true or false.";
  if (typeof via !== "string" || !VIAS.has(via)) return "via must be touchid, click or keyboard.";
  if (via === "touchid" && !approve) return "Touch ID can only approve.";
  return null;
}

// Keeps a TxView from pm, or returns null when it is not a usable pending one.
function cleanTx(tx, now) {
  if (!tx || typeof tx !== "object" || !validId(tx.id)) return null;
  if (tx.status !== undefined && tx.status !== "pending") return null;
  const expires = Number(tx.expires);
  if (Number.isFinite(expires) && expires > 0 && expires <= now) return null;
  return tx;
}

function sortByCreated(list) {
  return list.sort((a, b) => (Number(a.created) || 0) - (Number(b.created) || 0));
}

class Approvals {
  // BrowserWindow, screen, ipcMain and native are Electron's (or fakes in
  // tests). call(method, params) talks to pm. touchId is the lock screen's
  // TouchId, whose inline check is cancelled before the panel starts its own.
  // app is Electron's app (to activate APM); mainWindow() returns the main
  // window or null.
  constructor({ BrowserWindow, screen, ipcMain, native, touchId, call, url, preload, platform, packaged, log, timers, now, app, mainWindow }) {
    this.BrowserWindow = BrowserWindow;
    this.screen = screen;
    this.native = native || null;
    this.touchId = touchId || null;
    this.call = call;
    this.url = url;
    this.preload = preload;
    this.platform = platform || process.platform;
    this.packaged = !!packaged;
    this.log = log || (() => {});
    this.timers = timers || { setTimeout, clearTimeout };
    this.now = now || Date.now;
    this.app = app || null;
    this.mainWindow = mainWindow || (() => null);
    this.stole = false; // APM was activated for the panel, with no other window up
    this.queue = [];
    this.shown = null;
    this.win = null;
    this.ready = false;
    this.visible = false;
    this.height = 0;
    this.slot = null;
    this.active = null;
    this.seq = 0;
    this.rearmTimer = null;
    this.leaveTimer = null;
    this.expiryTimer = null;
    this.syncRun = 0;
    this.disposed = false;
    if (ipcMain) this.registerIpc(ipcMain);
  }

  // ---- IPC from the panel ----

  registerIpc(ipcMain) {
    ipcMain.handle("approval:decide", (e, id, approve, via) => this.decide(e && e.sender, id, approve, via));
    ipcMain.handle("approval:info", (e) => (this.fromPanel(e && e.sender) ? { touchId: this.touchAvailable() } : { touchId: false }));
    ipcMain.on("approval:touch-slot", (e, rect) => { if (this.fromPanel(e && e.sender)) this.setSlot(rect); });
    ipcMain.on("approval:size", (e, height) => { if (this.fromPanel(e && e.sender)) this.setSize(height); });
  }

  fromPanel(sender) {
    return !!(sender && this.win && !this.win.isDestroyed() && sender === this.win.webContents);
  }

  touchAvailable() {
    if (this.platform !== "darwin" || !this.native) return false;
    try { return !!this.native.available(); } catch (err) { return false; }
  }

  async decide(sender, id, approve, via) {
    if (!this.fromPanel(sender)) return invalid("Only the approval panel can decide.");
    const bad = checkDecision(id, approve, via);
    if (bad) return invalid(bad);
    const cur = this.shown;
    if (!cur || cur.id !== id || cur.leaving || cur.deciding) return invalid("That request is not the one on screen.");
    if (via === "touchid" && !cur.touchOk) return invalid("Touch ID has not approved this request.");
    // MCP settings "Approve with Touch ID only": without Touch ID on this Mac it falls back to any.
    if (approve && via !== "touchid" && cur.tx.approveWith === "touchid" && this.touchAvailable()) return invalid("This request needs Touch ID.");
    cur.deciding = true;
    this.disarm();
    let res;
    try {
      res = await this.call("mcp.tx.decide", { id, approve, via });
    } catch (err) {
      cur.deciding = false;
      if (this.shown === cur && !cur.leaving) this.arm();
      return { ok: false, error: { code: (err && err.code) || "internal", message: (err && err.message) || "Something went wrong." } };
    }
    cur.deciding = false;
    this.removeQueued(id);
    if (this.shown === cur) this.startLeaving();
    const out = { ok: true, status: res && typeof res.status === "string" ? res.status : approve ? "approved" : "rejected" };
    if (res && res.receipt) out.receipt = String(res.receipt);
    return out;
  }

  setSize(height) {
    const h = Number(height);
    if (!Number.isFinite(h) || h < 0 || h > MAX_HEIGHT) return;
    if (h === 0) {
      // The renderer reports 0 once the sheet has animated out.
      if (this.shown && this.shown.leaving) this.finishShown();
      return;
    }
    if (!this.shown || this.shown.leaving || !this.win || this.win.isDestroyed()) return;
    this.height = Math.ceil(h);
    this.place();
    if (!this.visible) {
      this.visible = true;
      // A non-activating panel becomes key without bringing APM forward, but
      // Touch ID only runs for the active app: activate APM too when that
      // brings nothing else forward.
      this.win.showInactive();
      if (!this.mainVisible()) this.activate();
      this.win.focus();
    }
  }

  setSlot(rect) {
    this.slot = rect ? validSlot(rect) : null;
    if (!this.slot) { this.disarm(); return; }
    if (this.active) {
      try { this.native.move(this.frame(), this.slot.dark, this.glyphSize()); } catch (err) {}
      return;
    }
    this.arm();
  }

  // ---- backend events ----

  pending(data) {
    const tx = cleanTx(data && data.tx, this.now());
    if (!tx) return;
    const i = this.queue.findIndex((t) => t.id === tx.id);
    if (i >= 0) this.queue[i] = tx;
    else this.queue.push(tx);
    sortByCreated(this.queue);
    this.pump();
  }

  resolved(data) {
    const id = data && data.id;
    if (!validId(id)) return;
    const status = typeof data.status === "string" ? data.status.slice(0, 32) : "resolved";
    this.removeQueued(id);
    if (this.shown && this.shown.id === id && !this.shown.leaving) {
      this.send("approval:resolved", { id, status });
      this.startLeaving();
    }
  }

  // Replaces the queue with pm's list. A request pm no longer has is over,
  // even if no mcp.resolved came for it (pm restarted in between).
  refresh(list) {
    const now = this.now();
    const txs = (Array.isArray(list) ? list : []).map((t) => cleanTx(t, now)).filter(Boolean);
    this.queue = sortByCreated(txs);
    if (this.shown && !this.shown.leaving && !this.queue.some((t) => t.id === this.shown.id)) {
      const expired = Number(this.shown.tx.expires) <= now;
      this.send("approval:resolved", { id: this.shown.id, status: expired ? "expired" : "resolved" });
      this.startLeaving();
      return;
    }
    this.pump();
  }

  // Fetches the pending list once pm answers: at start and after a restart.
  async sync() {
    const run = ++this.syncRun;
    for (let i = 0; i < SYNC_TRIES && !this.disposed; i++) {
      try {
        const res = await this.call("mcp.tx.pending", {});
        if (run === this.syncRun) this.refresh(res && res.tx);
        return true;
      } catch (err) {
        if (err && err.code && err.code !== "internal") return false; // pm answered: no such method or not allowed
        await new Promise((r) => this.timers.setTimeout(r, SYNC_DELAY_MS));
        if (run !== this.syncRun) return false;
      }
    }
    return false;
  }

  // ---- queue ----

  removeQueued(id) {
    this.queue = this.queue.filter((t) => t.id !== id);
  }

  pump() {
    if (this.disposed || this.shown) return;
    const now = this.now();
    this.queue = this.queue.filter((t) => cleanTx(t, now));
    const tx = this.queue[0];
    if (!tx) { this.closePanel(); return; }
    this.shown = { id: tx.id, tx, leaving: false, deciding: false, touchOk: false, fails: 0 };
    this.watchExpiry(tx);
    if (!this.win || this.win.isDestroyed()) this.createPanel();
    else if (this.ready) this.sendShow();
  }

  watchExpiry(tx) {
    this.clearTimer("expiryTimer");
    const ms = Number(tx.expires) - this.now();
    if (!Number.isFinite(ms)) return;
    this.expiryTimer = this.timers.setTimeout(() => {
      this.expiryTimer = null;
      if (this.shown && this.shown.id === tx.id && !this.shown.leaving) this.resolved({ id: tx.id, status: "expired" });
    }, Math.max(0, Math.min(ms, 2147483000)));
  }

  sendShow() {
    if (!this.shown) return;
    this.send("approval:show", { tx: this.shown.tx, touchId: this.touchAvailable() });
  }

  startLeaving() {
    const cur = this.shown;
    if (!cur || cur.leaving) return;
    cur.leaving = true;
    this.disarm();
    this.clearTimer("expiryTimer");
    this.clearTimer("leaveTimer");
    // If the renderer never says it is done (it crashed), move on anyway.
    this.leaveTimer = this.timers.setTimeout(() => {
      this.leaveTimer = null;
      if (this.shown === cur) this.finishShown();
    }, LEAVE_FALLBACK_MS);
  }

  finishShown() {
    this.clearTimer("leaveTimer");
    this.clearTimer("expiryTimer");
    this.disarm();
    this.shown = null;
    this.slot = null;
    this.pump();
  }

  // ---- window ----

  createPanel() {
    const mac = this.platform === "darwin";
    const win = new this.BrowserWindow({
      width: WIDTH,
      height: 320,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      title: "APM",
      ...(mac ? { type: "panel" } : {}),
      webPreferences: {
        preload: this.preload,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
        devTools: !this.packaged
      }
    });
    this.win = win;
    this.ready = false;
    this.visible = false;
    this.height = 0;
    try { win.setAlwaysOnTop(true, "screen-saver"); } catch (err) {}
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true }); } catch (err) {}
    const wc = win.webContents;
    const origin = new URL(this.url).origin;
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    wc.on("will-navigate", (event, url) => { if (!String(url).startsWith(origin + "/")) event.preventDefault(); });
    wc.on("will-attach-webview", (event) => event.preventDefault());
    wc.on("did-finish-load", () => { if (this.win !== win) return; this.ready = true; this.sendShow(); });
    wc.on("render-process-gone", () => { if (this.win === win) this.resetPanel(); });
    if (!this.packaged) {
      wc.on("console-message", (e) => {
        if (e && (e.level === "error" || e.level === "warning")) this.log("[approval " + e.level + "] " + String(e.message).slice(0, 2000));
      });
    }
    win.on("focus", () => { if (this.win !== win) return; if (this.shown) this.shown.cancels = 0; this.arm(); });
    win.on("blur", () => { if (this.win === win) this.disarm(); });
    win.on("closed", () => {
      if (this.win !== win) return;
      this.win = null;
      this.ready = false;
      this.visible = false;
      this.disarm();
      // Closed from outside (it never is by the user): show what is left later.
      if (this.shown) { this.shown = null; this.timers.setTimeout(() => this.pump(), 500); }
    });
    win.loadURL(this.url);
  }

  resetPanel() {
    const win = this.win;
    this.win = null;
    this.ready = false;
    this.visible = false;
    this.disarm();
    // The request on screen is still queued unless it was being dismissed, so
    // a fresh panel shows it again.
    if (this.shown) {
      this.clearTimer("leaveTimer");
      this.clearTimer("expiryTimer");
      this.shown = null;
      this.slot = null;
      this.timers.setTimeout(() => this.pump(), 500);
    }
    try { if (win && !win.isDestroyed()) win.destroy(); } catch (err) {}
  }

  // The panel is destroyed when the queue is empty, so a hidden window never
  // keeps the app alive where closing the last window quits it.
  closePanel() {
    this.disarm();
    const win = this.win;
    if (!win) return;
    this.win = null;
    this.ready = false;
    this.visible = false;
    try { if (!win.isDestroyed()) win.destroy(); } catch (err) {}
    this.giveBackFocus();
  }

  mainVisible() {
    try {
      const w = this.mainWindow();
      return !!(w && !w.isDestroyed() && w.isVisible() && !w.isMinimized());
    } catch (err) { return false; }
  }

  // Makes APM the active app, so LocalAuthentication runs the panel's check.
  activate() {
    if (this.platform !== "darwin" || !this.app || !this.touchAvailable()) return;
    if (!this.mainVisible()) this.stole = true;
    try { this.app.focus({ steal: true }); } catch (err) {}
  }

  // After the last request, hands the focus back to the app the user was in,
  // unless they have opened APM's main window since.
  giveBackFocus() {
    if (!this.stole) return;
    this.stole = false;
    if (this.mainVisible() || !this.app || typeof this.app.hide !== "function") return;
    try { this.app.hide(); } catch (err) {}
  }

  place() {
    if (!this.win || this.win.isDestroyed()) return;
    let wa = { x: 0, y: 0, width: 1440, height: 900 };
    try {
      const display = this.visible ? this.screen.getDisplayMatching(this.win.getBounds()) : this.screen.getDisplayNearestPoint(this.screen.getCursorScreenPoint());
      if (display && display.workArea) wa = display.workArea;
    } catch (err) {}
    const top = Math.round(wa.height * TOP_RATIO);
    const height = Math.max(1, Math.min(this.height, wa.height - top));
    const x = this.visible ? this.win.getBounds().x : wa.x + Math.round((wa.width - WIDTH) / 2);
    const y = this.visible ? this.win.getBounds().y : wa.y + top;
    this.win.setBounds({ x, y, width: WIDTH, height });
  }

  send(channel, data) {
    if (this.win && !this.win.isDestroyed() && this.ready) this.win.webContents.send(channel, data);
  }

  // ---- Touch ID ----

  frame() {
    let zoom = 1;
    try { zoom = this.win.webContents.getZoomFactor() || 1; } catch (err) {}
    const r = this.slot.rect;
    return { x: r.x * zoom, y: r.y * zoom, width: r.width * zoom, height: r.height * zoom };
  }

  glyphSize() {
    const f = this.frame();
    return Math.round(Math.min(f.width, f.height));
  }

  canArm() {
    const cur = this.shown;
    return !!(cur && !cur.leaving && !cur.deciding && !cur.touchOk && cur.fails < MAX_FAILS && this.slot && this.visible &&
      this.win && !this.win.isDestroyed() && this.win.isFocused() && this.touchAvailable());
  }

  arm() {
    if (this.active || !this.canArm()) return;
    this.clearTimer("rearmTimer");
    // The native module runs one check at a time; the lock screen's goes first.
    if (this.touchId) { try { this.touchId.cancelInline(); } catch (err) {} }
    const cur = this.shown;
    const token = ++this.seq;
    const client = String((cur.tx && cur.tx.client) || "an assistant").replace(/[\u0000-\u001f]/g, " ").slice(0, 120);
    const op = cur.tx && cur.tx.op;
    const reason = op === "connect" ? "allow " + client + " to use your vault"
      : op === "search_vault" ? "allow " + client + " to search your vault"
      : op === "get_entry" || op === "decrypt_entry" || op === "get_totp" ? "allow " + client + " to read a secret"
      : "approve a change from " + client;
    this.active = { token, id: cur.id };
    let started = false;
    try {
      started = !!this.native.start(this.win.getNativeWindowHandle(), this.frame(), this.slot.dark, reason, (ok, la) => this.onTouch(token, cur, ok, la), this.glyphSize());
    } catch (err) { started = false; }
    if (!started) { this.active = null; return; }
    this.send("approval:touch", { armed: true });
  }

  disarm() {
    this.clearTimer("rearmTimer");
    if (!this.active) return;
    this.active = null;
    this.send("approval:touch", { armed: false });
    try { this.native.cancel(); } catch (err) {}
  }

  onTouch(token, cur, ok, la) {
    if (!this.active || this.active.token !== token) return; // cancelled or replaced
    this.active = null;
    if (this.shown !== cur || cur.leaving || cur.deciding) return;
    // The system glyph is gone now. An {ok} message says so by itself, so the
    // renderer can keep its ridges hidden while the tick plays.
    if (ok) {
      cur.touchOk = true;
      this.send("approval:touch", { ok: true });
      return;
    }
    const code = codeFor(la);
    if (code === "cancelled") {
      this.send("approval:touch", { armed: false });
      this.log("[approval] Touch ID check cancelled (LAError " + la + ")" + (this.win && !this.win.isDestroyed() && this.win.isFocused() ? " while the panel was key" : ""));
      // Re-armed on focus. While the panel is still key the system called it
      // off because another app was active: activate APM and try again, more
      // slowly each time it keeps happening.
      if (!LA_CANCELS.has(Number(la)) || !this.win || this.win.isDestroyed() || !this.win.isFocused()) return;
      cur.cancels = (cur.cancels || 0) + 1;
      this.activate();
      const ms = Math.min(REARM_MS * Math.pow(2, cur.cancels - 1), REARM_MAX_MS);
      this.rearmTimer = this.timers.setTimeout(() => {
        this.rearmTimer = null;
        if (this.shown !== cur || !this.win || this.win.isDestroyed()) return;
        try { if (!this.win.isFocused()) this.win.focus(); } catch (err) {}
        this.arm();
      }, ms);
      return;
    }
    if (code === "failed") cur.fails += 1;
    else cur.fails = MAX_FAILS;
    this.send("approval:touch", { ok: false, code });
    if (cur.fails < MAX_FAILS) {
      this.rearmTimer = this.timers.setTimeout(() => { this.rearmTimer = null; if (this.shown === cur) this.arm(); }, REARM_MS);
    }
  }

  clearTimer(name) {
    if (this[name]) { this.timers.clearTimeout(this[name]); this[name] = null; }
  }

  dispose() {
    this.disposed = true;
    this.clearTimer("leaveTimer");
    this.clearTimer("expiryTimer");
    this.closePanel();
    this.shown = null;
    this.queue = [];
  }
}

module.exports = { Approvals, checkDecision, cleanTx, validId, WIDTH, MAX_FAILS };
