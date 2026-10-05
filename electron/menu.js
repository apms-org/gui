"use strict";

// Shared with the renderer, so a link changes in one place.
const LINKS = require("./links.json");
const DOCS_URL = LINKS.docs;
const ISSUES_URL = LINKS.issues;
const APP_NAME = "APM";

const RENDERER_KEYS = new Set([
  "CmdOrCtrl+N",
  "CmdOrCtrl+Shift+N",
  "CmdOrCtrl+,",
  "CmdOrCtrl+L",
  "CmdOrCtrl+K",
  "CmdOrCtrl+G",
  "CmdOrCtrl+/",
  "CmdOrCtrl+Shift+B",
  "CmdOrCtrl+Shift+C",
  "CmdOrCtrl+Shift+U",
  "CmdOrCtrl+Alt+1",
  "CmdOrCtrl+Alt+2",
  "CmdOrCtrl+Alt+3",
  "CmdOrCtrl+Alt+4"
]);

function menuTemplate(opts) {
  const { state, packaged, platform, action, openExternal } = opts;
  const appName = opts.appName || APP_NAME;
  const isMac = platform === "darwin";
  const unlocked = !(state && state.locked);
  const selected = unlocked && !!(state && state.hasSelection);
  const sep = { type: "separator" };

  const item = (label, accelerator, name, enabled) => {
    const entry = { id: name, label, action: name, click: () => action(name), enabled: !!enabled };
    if (accelerator) {
      entry.accelerator = accelerator;
      if (!isMac && RENDERER_KEYS.has(accelerator)) entry.registerAccelerator = false;
    }
    return entry;
  };

  const newItem = item("New Item", "CmdOrCtrl+N", "new-item", unlocked);
  const newSpace = item("New Space...", "CmdOrCtrl+Shift+N", "space-new", unlocked);
  const importItems = item("Import...", null, "import", unlocked);
  const exportItems = item("Export...", null, "export", unlocked);
  const settings = item(isMac ? "Settings..." : "Settings", "CmdOrCtrl+,", "settings", unlocked);
  const lock = item("Lock Vault", "CmdOrCtrl+L", "lock", unlocked);

  const template = [];

  if (isMac) {
    template.push({
      label: appName,
      submenu: [
        { role: "about", label: "About " + appName },
        sep,
        settings,
        lock,
        sep,
        { role: "services" },
        sep,
        { role: "hide", label: "Hide " + appName },
        { role: "hideOthers" },
        { role: "unhide" },
        sep,
        { role: "quit", label: "Quit " + appName }
      ]
    });
    template.push({
      label: "File",
      submenu: [newItem, newSpace, sep, importItems, exportItems, sep, { role: "close", label: "Close Window" }]
    });
  } else {
    template.push({
      label: "File",
      submenu: [newItem, newSpace, sep, importItems, exportItems, sep, settings, lock, sep, { role: "quit", label: "Exit" }]
    });
  }

  const edit = [{ role: "undo" }, { role: "redo" }, sep, { role: "cut" }, { role: "copy" }, { role: "paste" }];
  if (isMac) edit.push({ role: "pasteAndMatchStyle" });
  edit.push(
    { role: "delete" },
    { role: "selectAll" },
    sep,
    item("Copy Password", "CmdOrCtrl+Shift+C", "copy-password", selected),
    item("Copy Username", "CmdOrCtrl+Shift+U", "copy-username", selected),
    sep,
    item("Find", "CmdOrCtrl+F", "find", unlocked)
  );
  template.push({ label: "Edit", submenu: edit });

  const view = [
    item("Search...", "CmdOrCtrl+K", "search", unlocked),
    sep,
    item("Vault", "CmdOrCtrl+Alt+1", "view-vault", unlocked),
    item("Authenticator", "CmdOrCtrl+Alt+2", "view-authenticator", unlocked),
    item("Watchtower", "CmdOrCtrl+Alt+3", "view-watchtower", unlocked),
    item("History", "CmdOrCtrl+Alt+4", "view-history", unlocked),
    sep,
    item("Toggle Sidebar", "CmdOrCtrl+Shift+B", "toggle-sidebar", unlocked),
    item("Password Generator...", "CmdOrCtrl+G", "generator", unlocked),
    sep
  ];
  if (!packaged) view.push({ role: "reload" }, { role: "toggleDevTools" }, sep);
  view.push({ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, sep, { role: "togglefullscreen" });
  template.push({ label: "View", submenu: view });

  if (isMac) template.push({ role: "windowMenu" });

  const help = [
    { id: "docs", label: appName + " Documentation", click: () => openExternal(DOCS_URL) },
    item("Keyboard Shortcuts", "CmdOrCtrl+/", "shortcuts", unlocked),
    sep,
    { id: "issues", label: "Report an Issue", click: () => openExternal(ISSUES_URL) }
  ];
  if (!isMac) help.push(sep, { role: "about", label: "About " + appName });
  template.push({ role: "help", label: "Help", submenu: help });

  return template;
}

function aboutOptions(o) {
  return {
    applicationName: APP_NAME,
    applicationVersion: o.version,
    version: o.backendVersion ? "pm " + o.backendVersion : "",
    copyright: "Copyright 2026 aaravmaloo",
    website: LINKS.repo,
    ...(o.iconPath ? { iconPath: o.iconPath } : {})
  };
}

function buildMenu(opts) {
  const { Menu } = require("electron");
  return Menu.buildFromTemplate(menuTemplate(opts));
}

module.exports = { buildMenu, menuTemplate, aboutOptions, RENDERER_KEYS, DOCS_URL, ISSUES_URL, APP_NAME };
