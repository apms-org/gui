"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { menuTemplate, RENDERER_KEYS } = require("../electron/menu");

const shellSrc = fs.readFileSync(path.join(__dirname, "..", "renderer", "src", "screens", "shell.jsx"), "utf8");
const runMenuSrc = shellSrc.slice(shellSrc.indexOf("function runMenu"), shellSrc.indexOf("export function Shell"));
const handled = new Set([...runMenuSrc.matchAll(/action === "([a-z-]+)"/g)].map((m) => m[1]));
const handlesView = /action\.startsWith\("view-"\)/.test(runMenuSrc);
const VIEWS = new Set(["vault", "authenticator", "watchtower", "history", "settings"]);

function build(platform, state, packaged) {
  const calls = [];
  const t = menuTemplate({ platform, state: state || { locked: false, hasSelection: true }, packaged: !!packaged, action: (a) => calls.push(["action", a]), openExternal: (u) => calls.push(["url", u]) });
  return { t, calls };
}

function flat(items, out) {
  for (const i of items) {
    out.push(i);
    if (Array.isArray(i.submenu)) flat(i.submenu, out);
  }
  return out;
}

function byAction(t, name) {
  return flat(t, []).find((i) => i.action === name);
}

const PLATFORMS = ["darwin", "win32", "linux"];

test("top level menus per platform", () => {
  assert.deepStrictEqual(build("darwin").t.map((m) => m.label || m.role), ["APM", "File", "Edit", "View", "windowMenu", "Help"]);
  for (const p of ["win32", "linux"]) assert.deepStrictEqual(build(p).t.map((m) => m.label || m.role), ["File", "Edit", "View", "Help"]);
});

for (const p of PLATFORMS) {
  test(p + ": every custom item does something real", () => {
    const { t, calls } = build(p);
    for (const i of flat(t, [])) {
      if (i.type === "separator" || i.role || Array.isArray(i.submenu)) continue;
      assert.strictEqual(typeof i.click, "function", "no click on " + i.label);
      if (i.action) {
        const ok = handled.has(i.action) || (handlesView && i.action.startsWith("view-") && VIEWS.has(i.action.slice(5)));
        assert.ok(ok, "renderer does not handle " + i.action);
      }
      calls.length = 0;
      i.click();
      assert.strictEqual(calls.length, 1, i.label + " did not act");
      if (calls[0][0] === "url") assert.match(calls[0][1], /^https:\/\//);
    }
  });

  test(p + ": no duplicate accelerators", () => {
    const seen = new Map();
    for (const i of flat(build(p).t, [])) {
      if (!i.accelerator) continue;
      assert.ok(!seen.has(i.accelerator), i.accelerator + " on both " + seen.get(i.accelerator) + " and " + i.label);
      seen.set(i.accelerator, i.label);
    }
  });

  test(p + ": locked vault disables vault actions", () => {
    const { t } = build(p, { locked: true, hasSelection: true });
    for (const a of ["new-item", "space-new", "import", "export", "settings", "lock", "copy-password", "copy-username", "find", "search", "view-vault", "view-history", "generator", "toggle-sidebar", "shortcuts"]) {
      assert.strictEqual(byAction(t, a).enabled, false, a + " should be disabled while locked");
    }
    const about = flat(t, []).find((i) => i.role === "about");
    assert.ok(about, "about is reachable while locked");
    assert.notStrictEqual(about.enabled, false);
  });

  test(p + ": copy items need a selection", () => {
    const off = build(p, { locked: false, hasSelection: false }).t;
    const on = build(p, { locked: false, hasSelection: true }).t;
    for (const a of ["copy-password", "copy-username"]) {
      assert.strictEqual(byAction(off, a).enabled, false);
      assert.strictEqual(byAction(on, a).enabled, true);
    }
    assert.strictEqual(byAction(off, "new-item").enabled, true);
  });

  test(p + ": developer items only when not packaged", () => {
    const dev = flat(build(p, null, false).t, []).map((i) => i.role);
    const pkg = flat(build(p, null, true).t, []).map((i) => i.role);
    assert.ok(dev.includes("toggleDevTools") && dev.includes("reload"));
    assert.ok(!pkg.includes("toggleDevTools") && !pkg.includes("reload"));
  });
}

test("macOS app menu and platform conventions", () => {
  const mac = build("darwin").t;
  const app = mac[0].submenu.map((i) => i.label || i.role || i.type);
  assert.deepStrictEqual(app, ["About APM", "separator", "Settings...", "Lock Vault", "separator", "services", "separator", "Hide APM", "hideOthers", "unhide", "separator", "Quit APM"]);
  assert.ok(mac[1].submenu.some((i) => i.role === "close"));
  for (const p of ["win32", "linux"]) {
    const t = build(p).t;
    const quit = flat(t, []).find((i) => i.role === "quit");
    assert.strictEqual(quit.label, "Exit");
    assert.ok(t[t.length - 1].submenu.some((i) => i.role === "about"));
    assert.ok(!flat(t, []).some((i) => i.role === "services" || i.role === "hide"));
  }
});

test("renderer-handled keys are display only off macOS", () => {
  for (const i of flat(build("win32").t, [])) {
    if (!i.accelerator) continue;
    assert.strictEqual(i.registerAccelerator === false, RENDERER_KEYS.has(i.accelerator), i.label);
  }
  for (const i of flat(build("darwin").t, [])) assert.notStrictEqual(i.registerAccelerator, false);
});
