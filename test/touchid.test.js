"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TouchId, codeFor, validSlot } = require("../electron/touchid");

function fakeNative() {
  const n = { calls: [], cb: null, armed: false };
  n.available = () => true;
  n.start = (handle, rect, dark, reason, cb) => { n.calls.push(["start", rect, dark, reason]); n.cb = cb; n.armed = true; return true; };
  n.move = (rect, dark) => n.calls.push(["move", rect, dark]);
  n.cancel = () => { n.calls.push(["cancel"]); if (n.armed) { const cb = n.cb; n.armed = false; setImmediate(() => cb(false, -9)); } };
  n.finish = (ok, la) => { n.armed = false; n.cb(ok, la); };
  return n;
}

function fakeWindow(focused) {
  return { focused, isDestroyed: () => false, isFocused() { return this.focused; }, getNativeWindowHandle: () => Buffer.alloc(8), webContents: { getZoomFactor: () => 1.25 } };
}

function make(opts) {
  const o = opts || {};
  const replies = [];
  const notes = [];
  const win = fakeWindow(o.focused !== false);
  const t = new TouchId({
    window: () => win,
    reply: (p) => { replies.push(p); return Promise.resolve(); },
    notify: (on) => notes.push(on),
    native: o.native === undefined ? fakeNative() : o.native,
    prefs: o.prefs || { canPromptTouchID: () => true, promptTouchID: () => Promise.resolve() }
  });
  return { t, replies, notes, win };
}

const tick = () => new Promise((r) => setImmediate(r));
const SLOT = { x: 100, y: 200, width: 16, height: 16, dark: true };

test("maps LocalAuthentication errors to pm reply codes", () => {
  assert.equal(codeFor(-1), "failed");
  assert.equal(codeFor(-8), "lockout");
  assert.equal(codeFor(-6), "unavailable");
  assert.equal(codeFor(-7), "unavailable");
  for (const c of [-2, -3, -4, -9, -10, -1004]) assert.equal(codeFor(c), "cancelled");
});

test("validates the slot the renderer sends", () => {
  assert.deepEqual(validSlot(SLOT), { rect: { x: 100, y: 200, width: 16, height: 16 }, dark: true });
  assert.equal(validSlot(null), null);
  assert.equal(validSlot({ x: 1, y: 2, width: 0, height: 16 }), null);
  assert.equal(validSlot({ x: "a", y: 2, width: 16, height: 16 }), null);
  assert.equal(validSlot({ x: 1, y: 2, width: 99999, height: 16 }), null);
});

test("runs an inline prompt in the lock screen slot, scaled by zoom", async () => {
  const { t, replies, notes } = make();
  t.setSlot(SLOT);
  t.prompt({ id: 7, reason: "unlock your vault", inline: true });
  const start = t.native.calls[0];
  assert.equal(start[0], "start");
  assert.deepEqual(start[1], { x: 125, y: 250, width: 20, height: 20 });
  assert.equal(start[2], true);
  assert.deepEqual(notes, [true]);
  t.native.finish(true, 0);
  await tick();
  assert.deepEqual(replies, [{ id: 7, ok: true }]);
  assert.deepEqual(notes, [true, false]);
});

test("reports a rejected fingerprint and lockout", async () => {
  const { t, replies } = make();
  t.setSlot(SLOT);
  t.prompt({ id: 1, inline: true });
  t.native.finish(false, -1);
  t.prompt({ id: 2, inline: true });
  t.native.finish(false, -8);
  await tick();
  assert.deepEqual(replies, [{ id: 1, ok: false, code: "failed" }, { id: 2, ok: false, code: "lockout" }]);
});

test("follows the slot while armed and cancels when it goes away", async () => {
  const { t, replies, notes } = make();
  t.setSlot(SLOT);
  t.prompt({ id: 3, inline: true });
  t.setSlot(Object.assign({}, SLOT, { y: 240, dark: false }));
  assert.deepEqual(t.native.calls[1], ["move", { x: 125, y: 300, width: 20, height: 20 }, false]);
  t.setSlot(null);
  await tick();
  assert.deepEqual(replies, [{ id: 3, ok: false, code: "cancelled" }]);
  assert.deepEqual(notes, [true, false]);
});

test("never shows a dialog for an inline prompt the window cannot host", async () => {
  let dialogs = 0;
  const prefs = { canPromptTouchID: () => true, promptTouchID: () => { dialogs++; return Promise.resolve(); } };
  const unfocused = make({ focused: false, prefs });
  unfocused.t.setSlot(SLOT);
  unfocused.t.prompt({ id: 4, inline: true });
  const noSlot = make({ prefs });
  noSlot.t.prompt({ id: 5, inline: true });
  await tick();
  assert.equal(dialogs, 0);
  assert.deepEqual(unfocused.replies, [{ id: 4, ok: false, code: "cancelled" }]);
  assert.deepEqual(noSlot.replies, [{ id: 5, ok: false, code: "cancelled" }]);
});

test("uses the system dialog, named for APM, outside the lock screen", async () => {
  const reasons = [];
  const prefs = { canPromptTouchID: () => true, promptTouchID: (r) => { reasons.push(r); return Promise.reject(new Error("User cancelled")); } };
  const { t, replies } = make({ prefs });
  t.setSlot(SLOT);
  t.prompt({ id: 6, reason: "unlock your vault for the browser extension", inline: false });
  await tick(); await tick();
  assert.deepEqual(reasons, ["unlock your vault for the browser extension"]);
  assert.deepEqual(t.native.calls, []);
  assert.deepEqual(replies, [{ id: 6, ok: false, code: "cancelled" }]);
});

test("falls back to the dialog without the native module", async () => {
  let dialogs = 0;
  const prefs = { canPromptTouchID: () => true, promptTouchID: () => { dialogs++; return Promise.resolve(); } };
  const { t, replies } = make({ native: null, prefs });
  assert.equal(t.inline, false);
  t.setSlot(SLOT);
  t.prompt({ id: 8, inline: true });
  await tick(); await tick();
  assert.equal(dialogs, 1);
  assert.deepEqual(replies, [{ id: 8, ok: true }]);
});

test("a new prompt replaces an armed one", async () => {
  const { t, replies } = make();
  t.setSlot(SLOT);
  t.prompt({ id: 9, inline: true });
  t.prompt({ id: 10, inline: true });
  await tick();
  assert.deepEqual(replies, [{ id: 9, ok: false, code: "cancelled" }]);
  t.native.finish(true, 0);
  await tick();
  assert.deepEqual(replies[1], { id: 10, ok: true });
});
