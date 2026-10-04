"use strict";

// Touch ID for the desktop app. pm asks for a fingerprint with a
// touchid.prompt event and waits for touchid.reply, so the check runs here,
// in APM, rather than in osascript.
//
// On the lock screen the check runs inline: native/touchid.mm embeds macOS's
// own Touch ID glyph over the lock screen's button and no system dialog
// appears, the way the macOS lock screen works. Without the module, or when
// the lock screen is not showing (the browser extension asking to unlock),
// the system dialog names APM.

const path = require("node:path");
const electron = require("electron");

// LAError codes (LocalAuthentication/LAError.h).
const LA = { authenticationFailed: -1, userCancel: -2, userFallback: -3, systemCancel: -4, biometryNotAvailable: -6, biometryNotEnrolled: -7, biometryLockout: -8, appCancel: -9, invalidContext: -10, notInteractive: -1004 };

function codeFor(la) {
  switch (la) {
    case LA.authenticationFailed: return "failed";
    case LA.biometryLockout: return "lockout";
    case LA.biometryNotAvailable:
    case LA.biometryNotEnrolled: return "unavailable";
    default: return "cancelled";
  }
}

function loadNative({ packaged, resourcesPath }) {
  if (process.platform !== "darwin") return null;
  const file = packaged ? path.join(resourcesPath, "native", "apm_touchid.node") : path.join(__dirname, "..", "native", "build", "apm_touchid.node");
  try { return require(file); } catch (err) { return null; }
}

function validSlot(slot) {
  if (!slot || typeof slot !== "object") return null;
  const r = { x: Number(slot.x), y: Number(slot.y), width: Number(slot.width), height: Number(slot.height) };
  if (![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0 || r.width > 4096 || r.height > 4096) return null;
  return { rect: r, dark: !!slot.dark };
}

class TouchId {
  // native and prefs (systemPreferences) can be passed in for tests.
  constructor({ packaged, resourcesPath, window, reply, notify, native, prefs }) {
    this.native = native !== undefined ? native : loadNative({ packaged, resourcesPath });
    this.prefs = prefs || electron.systemPreferences;
    this.window = window;
    this.reply = reply;
    this.notify = notify;
    this.slot = null;
    this.active = null;
  }

  // Whether the lock screen can run Touch ID inline right now.
  get inline() {
    try { return !!(this.native && this.native.available()); } catch (err) { return false; }
  }

  // The lock screen reports where its Touch ID glyph goes, in CSS pixels.
  setSlot(slot) {
    this.slot = validSlot(slot);
    if (!this.active || !this.active.inline) return;
    if (!this.slot) { this.cancelInline(); return; }
    try { this.native.move(this.frame(), this.slot.dark); } catch (err) {}
  }

  frame() {
    const win = this.window();
    const zoom = win ? win.webContents.getZoomFactor() : 1;
    const r = this.slot.rect;
    return { x: r.x * zoom, y: r.y * zoom, width: r.width * zoom, height: r.height * zoom };
  }

  prompt(data) {
    const id = data && Number(data.id);
    if (!Number.isFinite(id)) return;
    const reason = String((data && data.reason) || "unlock your vault").slice(0, 200);
    if (this.active) this.cancelInline();
    const win = this.window();
    if (data.inline && this.inline) {
      // The lock screen arms Touch ID on its own, so it must never surface a
      // dialog: without focus or a place for the glyph it just stands down
      // and re-arms when the window is focused again.
      if (!this.slot || !win || win.isDestroyed() || !win.isFocused()) {
        this.answer(id, { ok: false, code: "cancelled" });
        return;
      }
      let started = false;
      this.active = { id, inline: true };
      try {
        started = this.native.start(win.getNativeWindowHandle(), this.frame(), this.slot.dark, reason, (ok, la) => {
          if (this.active && this.active.id === id) { this.active = null; this.notify(false); }
          this.answer(id, ok ? { ok: true } : { ok: false, code: codeFor(la) });
        });
      } catch (err) { started = false; }
      if (started) { this.notify(true); return; }
      this.active = null;
    }
    this.dialog(id, reason);
  }

  dialog(id, reason) {
    const prefs = this.prefs;
    if (!prefs || !prefs.canPromptTouchID || !prefs.canPromptTouchID()) {
      this.answer(id, { ok: false, code: "unavailable" });
      return;
    }
    this.active = { id, inline: false };
    prefs.promptTouchID(reason).then(
      () => ({ ok: true }),
      (err) => ({ ok: false, code: /cancel/i.test(String(err && err.message)) ? "cancelled" : "failed" })
    ).then((res) => {
      if (this.active && this.active.id === id) this.active = null;
      this.answer(id, res);
    });
  }

  answer(id, res) {
    Promise.resolve(this.reply(Object.assign({ id }, res))).catch(() => {});
  }

  // Stops an inline check: the window lost focus, the password was typed, or
  // the lock screen went away. pm hears "cancelled". A system dialog cannot be
  // taken back, so it is left to finish.
  cancelInline(id) {
    if (!this.active || !this.active.inline) return;
    if (id !== undefined && this.active.id !== id) return;
    this.active = null;
    this.notify(false);
    try { this.native.cancel(); } catch (err) {}
  }
}

module.exports = { TouchId, codeFor, validSlot };
