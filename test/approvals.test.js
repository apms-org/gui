"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Approvals, checkDecision, cleanTx, validId, WIDTH } = require("../electron/approvals");

const NOW = 1_700_000_000_000;

function tx(id, created, extra) {
  return Object.assign({ id, client: "claude-code", op: "add_entry", summary: "add", entry: { type: "apikey", name: "Key", f: {} }, created, expires: NOW + 15 * 60000, status: "pending" }, extra || {});
}

function fakeTimers() {
  const t = { list: [], nextId: 1 };
  t.setTimeout = (fn, ms) => { const id = t.nextId++; t.list.push({ id, fn, ms }); return id; };
  t.clearTimeout = (id) => { t.list = t.list.filter((x) => x.id !== id); };
  t.run = (pred) => { const due = t.list.filter(pred || (() => true)); t.list = t.list.filter((x) => !due.includes(x)); due.forEach((x) => x.fn()); return due.length; };
  return t;
}

function fakeNative(available) {
  const n = { calls: [], cb: null, armed: false };
  n.available = () => available !== false;
  n.start = (handle, rect, dark, reason, cb, size) => { n.calls.push(["start", rect, dark, reason, size]); n.cb = cb; n.armed = true; return true; };
  n.move = (rect, dark, size) => n.calls.push(["move", rect, dark, size]);
  n.cancel = () => { n.calls.push(["cancel"]); if (n.armed) { const cb = n.cb; n.armed = false; setImmediate(() => cb(false, -9)); } };
  n.finish = (ok, la) => { n.armed = false; n.cb(ok, la); };
  return n;
}

function makeBrowserWindow(record) {
  return class FakeWindow extends EventEmitter {
    constructor(opts) {
      super();
      this.opts = opts;
      this.destroyed = false;
      this.focused = false;
      this.bounds = { x: 0, y: 0, width: opts.width, height: opts.height };
      this.sent = [];
      this.calls = [];
      this.webContents = new EventEmitter();
      this.webContents.send = (ch, data) => this.sent.push([ch, data]);
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.getZoomFactor = () => 1;
      record.push(this);
    }
    loadURL(url) { this.url = url; }
    isDestroyed() { return this.destroyed; }
    isFocused() { return this.focused; }
    destroy() { this.destroyed = true; this.emit("closed"); }
    setAlwaysOnTop(...a) { this.calls.push(["setAlwaysOnTop", ...a]); }
    setVisibleOnAllWorkspaces(...a) { this.calls.push(["setVisibleOnAllWorkspaces", ...a]); }
    setBounds(b) { this.bounds = b; }
    getBounds() { return this.bounds; }
    getNativeWindowHandle() { return Buffer.alloc(8); }
    showInactive() { this.calls.push(["showInactive"]); }
    focus() { this.calls.push(["focus"]); this.focused = true; this.emit("focus"); }
    blur() { this.focused = false; this.emit("blur"); }
    // test helpers
    load() { this.webContents.emit("did-finish-load"); }
    channel(name) { return this.sent.filter(([ch]) => ch === name).map(([, d]) => d); }
  };
}

function fakeIpc() {
  const ipc = { handlers: {}, listeners: {} };
  ipc.handle = (ch, fn) => { ipc.handlers[ch] = fn; };
  ipc.on = (ch, fn) => { ipc.listeners[ch] = fn; };
  return ipc;
}

function make(opts) {
  const o = opts || {};
  const windows = [];
  const calls = [];
  const ipc = fakeIpc();
  const timers = fakeTimers();
  const cancels = [];
  const a = new Approvals({
    BrowserWindow: makeBrowserWindow(windows),
    screen: {
      getCursorScreenPoint: () => ({ x: 2000, y: 100 }),
      getDisplayNearestPoint: () => ({ workArea: { x: 1440, y: 25, width: 1920, height: 1000 } }),
      getDisplayMatching: () => ({ workArea: { x: 1440, y: 25, width: 1920, height: 1000 } })
    },
    ipcMain: ipc,
    native: o.native === undefined ? fakeNative() : o.native,
    touchId: { cancelInline: () => cancels.push(true) },
    call: o.call || (async (method, params) => { calls.push([method, params]); return method === "mcp.tx.decide" ? { status: params.approve ? "committed" : "rejected", receipt: params.approve ? "rcpt_1" : undefined } : { tx: [] }; }),
    url: "app://bundle/approval.html",
    preload: "/x/approval-preload.js",
    platform: "darwin",
    packaged: true,
    timers,
    now: () => NOW,
    app: o.app,
    mainWindow: o.mainWindow
  });
  const win = () => windows[windows.length - 1];
  const ev = () => ({ sender: win().webContents });
  const decide = (id, approve, via, e) => ipc.handlers["approval:decide"](e || ev(), id, approve, via);
  const size = (h) => ipc.listeners["approval:size"](ev(), h);
  const slot = (r) => ipc.listeners["approval:touch-slot"](ev(), r);
  return { a, windows, win, calls, ipc, timers, cancels, decide, size, slot, ev };
}

const tickIo = () => new Promise((r) => setImmediate(r));
const SLOT = { x: 192, y: 409, width: 64, height: 64, dark: true };

test("validates ids and decisions", () => {
  assert.ok(validId("tx_0a1b2c"));
  for (const bad of ["tx_", "tx_XYZ", "TX_00", "tx_00 ", "tx_00/../", 7, null, "tx_" + "a".repeat(200)]) assert.equal(validId(bad), false, String(bad));
  assert.equal(checkDecision("tx_01", true, "click"), null);
  assert.equal(checkDecision("tx_01", false, "keyboard"), null);
  assert.equal(checkDecision("tx_01", true, "touchid"), null);
  assert.match(checkDecision("tx_01", "yes", "click"), /approve/);
  assert.match(checkDecision("tx_01", true, "dialog"), /via/);
  assert.match(checkDecision("tx_01", true, "app"), /via/);
  assert.match(checkDecision("tx_01", false, "touchid"), /Touch ID/);
  assert.match(checkDecision("nope", true, "click"), /id/);
});

test("keeps only pending, unexpired requests", () => {
  assert.ok(cleanTx(tx("tx_01", 1), NOW));
  assert.equal(cleanTx(tx("tx_01", 1, { status: "approved" }), NOW), null);
  assert.equal(cleanTx(tx("tx_01", 1, { expires: NOW - 1 }), NOW), null);
  assert.equal(cleanTx(tx("bad", 1), NOW), null);
  assert.equal(cleanTx(null, NOW), null);
});

test("creates a non-activating, always-on-top panel and keeps the queue oldest first", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_02", 200) });
  t.a.pending({ tx: tx("tx_01", 100) });
  const w = t.win();
  assert.equal(t.windows.length, 1);
  assert.equal(w.opts.type, "panel");
  assert.equal(w.opts.transparent, true);
  assert.equal(w.opts.backgroundColor, "#00000000");
  assert.equal(w.opts.hasShadow, false);
  assert.equal(w.opts.show, false);
  assert.equal(w.opts.webPreferences.sandbox, true);
  assert.equal(w.opts.webPreferences.contextIsolation, true);
  assert.equal(w.opts.webPreferences.nodeIntegration, false);
  assert.equal(w.opts.webPreferences.preload, "/x/approval-preload.js");
  assert.equal(w.url, "app://bundle/approval.html");
  assert.deepEqual(w.calls[0], ["setAlwaysOnTop", true, "screen-saver"]);
  assert.deepEqual(w.calls[1], ["setVisibleOnAllWorkspaces", true, { visibleOnFullScreen: true, skipTransformProcessType: true }]);
  // tx_02 arrived first, so it stays on screen; tx_01 is next because it is older.
  assert.equal(t.a.shown.id, "tx_02");
  w.load();
  assert.equal(w.channel("approval:show")[0].tx.id, "tx_02");
  assert.deepEqual(t.a.queue.map((x) => x.id), ["tx_01", "tx_02"]);
});

test("sizes and positions the panel from the renderer, then shows it without activating", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.size(0); // the empty page before the sheet mounts
  assert.equal(w.calls.some((c) => c[0] === "showInactive"), false);
  t.size(612.4);
  assert.deepEqual(w.bounds, { x: 1440 + Math.round((1920 - WIDTH) / 2), y: 25 + 120, width: WIDTH, height: 613 });
  const order = w.calls.map((c) => c[0]).filter((c) => c === "showInactive" || c === "focus");
  assert.deepEqual(order, ["showInactive", "focus"]);
  t.size(700);
  assert.equal(w.bounds.height, 700);
  assert.equal(w.calls.filter((c) => c[0] === "showInactive").length, 1);
  t.size(-1); t.size("x"); t.size(1e9);
  assert.equal(w.bounds.height, 700);
});

test("ignores IPC from any other sender", async () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  t.win().load();
  const other = { sender: { id: "main-window" } };
  const r = await t.decide("tx_01", true, "click", other);
  assert.equal(r.ok, false);
  assert.equal(t.calls.length, 0);
  t.ipc.listeners["approval:size"](other, 500);
  assert.equal(t.win().calls.some((c) => c[0] === "showInactive"), false);
  assert.deepEqual(await t.ipc.handlers["approval:info"](other), { touchId: false });
  assert.deepEqual(await t.ipc.handlers["approval:info"](t.ev()), { touchId: true });
});

test("forwards a decision only for the request on screen", async () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  t.a.pending({ tx: tx("tx_02", 2) });
  t.win().load();
  for (const [id, approve, via] of [["tx_02", true, "click"], ["tx_01", "true", "click"], ["tx_01", true, "app"], ["tx_01", true, "touchid"], ["../x", true, "click"]]) {
    const r = await t.decide(id, approve, via);
    assert.equal(r.ok, false, JSON.stringify([id, approve, via]));
    assert.equal(r.error.code, "invalid");
  }
  assert.equal(t.calls.length, 0);
  const r = await t.decide("tx_01", true, "click");
  assert.deepEqual(r, { ok: true, status: "committed", receipt: "rcpt_1" });
  assert.deepEqual(t.calls, [["mcp.tx.decide", { id: "tx_01", approve: true, via: "click" }]]);
  // A second decision for the same request is refused while it animates out.
  assert.equal((await t.decide("tx_01", false, "click")).ok, false);
  assert.equal(t.calls.length, 1);
});

test("moves on to the next request once the sheet has gone, and closes the panel when the queue is empty", async () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  t.a.pending({ tx: tx("tx_02", 2) });
  const w = t.win();
  w.load();
  t.size(600);
  await t.decide("tx_01", false, "keyboard");
  assert.equal(w.channel("approval:show").length, 1);
  t.size(0);
  assert.equal(t.a.shown.id, "tx_02");
  assert.equal(w.channel("approval:show")[1].tx.id, "tx_02");
  await t.decide("tx_02", true, "click");
  t.size(0);
  assert.equal(t.a.shown, null);
  assert.equal(w.destroyed, true);
  assert.equal(t.a.win, null);
});

test("tells the renderer when the request on screen is resolved elsewhere", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  t.a.pending({ tx: tx("tx_02", 2) });
  const w = t.win();
  w.load();
  t.a.resolved({ id: "tx_02", status: "rejected" });
  assert.deepEqual(w.channel("approval:resolved"), []);
  assert.deepEqual(t.a.queue.map((x) => x.id), ["tx_01"]);
  t.a.resolved({ id: "tx_01", status: "approved" });
  assert.deepEqual(w.channel("approval:resolved"), [{ id: "tx_01", status: "approved" }]);
  t.a.resolved({ id: "tx_01", status: "approved" });
  assert.equal(w.channel("approval:resolved").length, 1);
  t.a.resolved({ id: "<script>", status: "x" });
  assert.equal(w.channel("approval:resolved").length, 1);
});

test("moves on even if the renderer never reports the sheet gone", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  t.win().load();
  t.a.resolved({ id: "tx_01", status: "expired" });
  assert.ok(t.a.shown);
  t.timers.run((x) => x.ms === 4000);
  assert.equal(t.a.shown, null);
});

test("refresh drops a request pm no longer has", () => {
  const t = make();
  t.a.refresh([tx("tx_01", 1), tx("tx_02", 2)]);
  const w = t.win();
  w.load();
  assert.equal(t.a.shown.id, "tx_01");
  t.a.refresh([tx("tx_02", 2)]);
  assert.deepEqual(w.channel("approval:resolved"), [{ id: "tx_01", status: "resolved" }]);
  t.size(0);
  assert.equal(t.a.shown.id, "tx_02");
});

test("sync retries until pm answers mcp.tx.pending", async () => {
  let n = 0;
  const t = make({ call: async (method) => { n++; if (n < 3) { const e = new Error("not running"); e.code = "internal"; throw e; } return { tx: [tx("tx_0f", 1)] }; } });
  const p = t.a.sync();
  for (let i = 0; i < 5; i++) { await tickIo(); t.timers.run((x) => x.ms === 300); }
  assert.equal(await p, true);
  assert.equal(t.a.shown.id, "tx_0f");
});

test("arms Touch ID over the glyph slot once the panel is shown and focused", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1, { client: "claude-code" }) });
  const w = t.win();
  w.load();
  t.slot(SLOT); // not visible yet
  assert.equal(t.a.native.calls.length, 0);
  t.size(600); // showInactive + focus arms it
  const start = t.a.native.calls[0];
  assert.equal(start[0], "start");
  assert.deepEqual(start[1], { x: 192, y: 409, width: 64, height: 64 });
  assert.equal(start[2], true);
  assert.equal(start[3], "approve a change from claude-code");
  assert.equal(start[4], 64);
  assert.equal(t.cancels.length, 1, "the lock screen's inline check is cancelled first");
  assert.deepEqual(w.channel("approval:touch"), [{ armed: true }]);
  t.slot({ x: 200, y: 400, width: 64, height: 64, dark: false });
  assert.deepEqual(t.a.native.calls[1], ["move", { x: 200, y: 400, width: 64, height: 64 }, false, 64]);
});

test("a fingerprint unlocks a touchid decision; a click never needs one", async () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.slot(SLOT);
  t.size(600);
  t.a.native.finish(true, 0);
  assert.deepEqual(w.channel("approval:touch").pop(), { ok: true });
  const r = await t.decide("tx_01", true, "touchid");
  assert.equal(r.ok, true);
  assert.deepEqual(t.calls[0], ["mcp.tx.decide", { id: "tx_01", approve: true, via: "touchid" }]);
});

test("re-arms after a wrong finger and stops after three", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.slot(SLOT);
  t.size(600);
  for (let i = 1; i <= 3; i++) {
    t.a.native.finish(false, -1);
    assert.deepEqual(w.channel("approval:touch").pop(), { ok: false, code: "failed" });
    const rearmed = t.timers.run((x) => x.ms === 600);
    assert.equal(rearmed, i < 3 ? 1 : 0);
  }
  assert.equal(t.a.native.calls.filter((c) => c[0] === "start").length, 3);
  assert.equal(t.a.active, null);
});

test("lockout stops Touch ID at once; a cancel is not a failure", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.slot(SLOT);
  t.size(600);
  t.a.native.finish(false, -4); // system cancel
  assert.deepEqual(w.channel("approval:touch").pop(), { armed: false });
  assert.equal(t.a.shown.fails, 0);
  w.blur();
  w.focus();
  assert.equal(t.a.native.calls.filter((c) => c[0] === "start").length, 2);
  t.a.native.finish(false, -8);
  assert.deepEqual(w.channel("approval:touch").pop(), { ok: false, code: "lockout" });
  assert.equal(t.timers.run((x) => x.ms === 600), 0);
  w.blur(); w.focus();
  assert.equal(t.a.native.calls.filter((c) => c[0] === "start").length, 2);
});

test("cancels Touch ID on blur and ignores the stale callback", async () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.slot(SLOT);
  t.size(600);
  w.blur();
  assert.deepEqual(t.a.native.calls.pop(), ["cancel"]);
  await tickIo(); // the cancelled check reports -9
  assert.equal(t.a.shown.fails, 0);
  assert.deepEqual(w.channel("approval:touch").pop(), { armed: false });
  w.focus();
  assert.equal(t.a.native.calls.filter((c) => c[0] === "start").length, 2);
  t.slot(null);
  assert.deepEqual(t.a.native.calls.pop(), ["cancel"]);
});

test("without the native module the panel reports no Touch ID and never arms", () => {
  const t = make({ native: null });
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  assert.equal(w.channel("approval:show")[0].touchId, false);
  t.slot(SLOT);
  t.size(600);
  assert.equal(t.a.active, null);
});

test("expires the request on screen when its time runs out", () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1, { expires: NOW + 1000 }) });
  const w = t.win();
  w.load();
  t.timers.run((x) => x.ms === 1000);
  assert.deepEqual(w.channel("approval:resolved"), [{ id: "tx_01", status: "expired" }]);
});

function fakeApp(calls) {
  return { focus: (opts) => calls.push(["app.focus", opts]), hide: () => calls.push(["app.hide"]) };
}

function fakeMain(visible) {
  return { visible, isDestroyed: () => false, isVisible() { return this.visible; }, isMinimized: () => false };
}

test("a request that needs Touch ID refuses a click or key approve while Touch ID is available", async () => {
  const t = make();
  t.a.pending({ tx: tx("tx_01", 1, { approveWith: "touchid" }) });
  const w = t.win();
  w.load();
  t.slot(SLOT);
  t.size(600);
  for (const via of ["click", "keyboard"]) {
    const r = await t.decide("tx_01", true, via);
    assert.deepEqual(r, { ok: false, error: { code: "invalid", message: "This request needs Touch ID." } });
  }
  assert.equal(t.calls.length, 0);
  t.a.native.finish(true, 0);
  const r = await t.decide("tx_01", true, "touchid");
  assert.equal(r.ok, true);
  assert.deepEqual(t.calls, [["mcp.tx.decide", { id: "tx_01", approve: true, via: "touchid" }]]);
});

test("a request that needs Touch ID can still be rejected with a click or Esc", async () => {
  for (const via of ["click", "keyboard"]) {
    const t = make();
    t.a.pending({ tx: tx("tx_01", 1, { approveWith: "touchid" }) });
    t.win().load();
    const r = await t.decide("tx_01", false, via);
    assert.equal(r.ok, true);
    assert.deepEqual(t.calls, [["mcp.tx.decide", { id: "tx_01", approve: false, via }]]);
  }
});

test("without Touch ID a request that needs it approves with a click", async () => {
  for (const native of [null, fakeNative(false)]) {
    const t = make({ native });
    t.a.pending({ tx: tx("tx_01", 1, { approveWith: "touchid" }) });
    t.win().load();
    const r = await t.decide("tx_01", true, "click");
    assert.equal(r.ok, true);
  }
});

test("names read requests in the Touch ID reason", () => {
  for (const [op, reason] of [["get_entry", "allow claude-code to read a secret"], ["decrypt_entry", "allow claude-code to read a secret"], ["get_totp", "allow claude-code to read a secret"], ["search_vault", "allow claude-code to search your vault"], ["connect", "allow claude-code to use your vault"]]) {
    const t = make();
    t.a.pending({ tx: tx("tx_01", 1, { op }) });
    t.win().load();
    t.slot(SLOT);
    t.size(600);
    assert.equal(t.a.native.calls[0][3], reason, op);
  }
});

test("activates APM when the panel shows with no main window up, and hands focus back after", async () => {
  const appCalls = [];
  const t = make({ app: fakeApp(appCalls), mainWindow: () => null });
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.size(600);
  assert.deepEqual(appCalls, [["app.focus", { steal: true }]]);
  // Activated after showInactive and before the panel takes key.
  const order = w.calls.map((c) => c[0]).filter((c) => c === "showInactive" || c === "focus");
  assert.deepEqual(order, ["showInactive", "focus"]);
  await t.decide("tx_01", false, "keyboard");
  t.size(0);
  assert.equal(w.destroyed, true);
  assert.deepEqual(appCalls.pop(), ["app.hide"]);
});

test("never activates APM over a visible main window just to show the panel", async () => {
  const appCalls = [];
  const main = fakeMain(true);
  const t = make({ app: fakeApp(appCalls), mainWindow: () => main });
  t.a.pending({ tx: tx("tx_01", 1) });
  t.win().load();
  t.size(600);
  assert.deepEqual(appCalls, []);
  await t.decide("tx_01", false, "keyboard");
  t.size(0);
  assert.deepEqual(appCalls, [], "no hide when APM was never activated for the panel");
});

test("does not activate when Touch ID is not available", () => {
  const appCalls = [];
  const t = make({ app: fakeApp(appCalls), mainWindow: () => null, native: null });
  t.a.pending({ tx: tx("tx_01", 1) });
  t.win().load();
  t.size(600);
  assert.deepEqual(appCalls, []);
});

test("a system cancel while the panel is key activates APM and re-arms, backing off", () => {
  const appCalls = [];
  const main = fakeMain(true);
  const t = make({ app: fakeApp(appCalls), mainWindow: () => main });
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.slot(SLOT);
  t.size(600);
  const starts = () => t.a.native.calls.filter((c) => c[0] === "start").length;
  assert.equal(starts(), 1);
  t.a.native.finish(false, -4); // systemCancel: another app is active
  assert.deepEqual(w.channel("approval:touch").pop(), { armed: false });
  assert.equal(t.a.shown.fails, 0, "a cancel is not a wrong finger");
  // Touch ID needs APM active, even with the main window up.
  assert.deepEqual(appCalls, [["app.focus", { steal: true }]]);
  assert.equal(t.timers.run((x) => x.ms === 600), 1);
  assert.equal(starts(), 2);
  assert.deepEqual(w.channel("approval:touch").pop(), { armed: true });
  t.a.native.finish(false, -9); // appCancel
  assert.equal(t.timers.run((x) => x.ms === 600), 0);
  assert.equal(t.timers.run((x) => x.ms === 1200), 1);
  assert.equal(starts(), 3);
  for (let i = 0; i < 4; i++) { t.a.native.finish(false, -4); t.timers.run((x) => x.ms >= 600 && x.ms <= 5000); }
  assert.equal(starts(), 7);
  t.a.native.finish(false, -4);
  assert.ok(t.timers.list.some((x) => x.ms === 5000), "the delay stops growing at 5s");
  // Taking key again starts over at once, with the shortest delay next time.
  w.blur();
  w.focus();
  assert.equal(starts(), 8);
  t.a.native.finish(false, -4);
  assert.ok(t.timers.list.some((x) => x.ms === 600));
});

test("a cancel after the panel lost key waits for it to become key again", () => {
  const appCalls = [];
  const t = make({ app: fakeApp(appCalls), mainWindow: () => null });
  t.a.pending({ tx: tx("tx_01", 1) });
  const w = t.win();
  w.load();
  t.slot(SLOT);
  t.size(600);
  appCalls.length = 0;
  w.focused = false; // the user clicked another app; the check ends before blur arrives
  t.a.native.finish(false, -4);
  assert.equal(t.timers.list.filter((x) => x.ms === 600).length, 0);
  assert.deepEqual(appCalls, []);
  w.focus(); // a click on the panel
  assert.equal(t.a.native.calls.filter((c) => c[0] === "start").length, 2);
});
