"use strict";

const { app, BrowserWindow, ipcMain, clipboard, dialog, Menu, shell, protocol, net, powerMonitor, nativeTheme, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Backend, toEnvelopeError } = require("./backend");
const { TouchId } = require("./touchid");
const { CliInstaller, bundleRootFor } = require("./cli-install");
const paths = require("./paths");
const { buildMenu, aboutOptions, APP_NAME } = require("./menu");

const SCHEME = "app";
const HOST = "bundle";
const DIST = path.join(__dirname, "..", "dist");
const READ_LIMIT = 50 * 1024 * 1024;
const IDLE_POLL_MS = 15000;
const IDLE_MIN_SECONDS = 60;
const LOCK_POLL_MS = 5000;
const UNLOCK_METHODS = new Set(["vault.unlock", "vault.unlockTouchID", "vault.unlockSession", "vault.setup"]);

const userDataOverride = process.env.APM_USER_DATA_DIR;
app.setPath("userData", userDataOverride ? path.resolve(userDataOverride) : path.join(app.getPath("appData"), "APM Desktop"));

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

let mainWindow = null;
let backend = null;
let vaultPath = null;
let pmPath = null;
let pmSource = null;
let menuState = { locked: true, hasSelection: false };
let idleTimer = null;
let lockTimer = null;
// The renderer runs auto-lock while a window is open. On macOS the app, and
// with it the extension bridge, keeps running after the last window closes, so
// the main process applies the same policy until a window comes back.
const lockWatch = { settings: {}, unlockedAt: 0, lastActive: 0, locking: false };
let clip = { text: null, timer: null };
const approvedWrite = new Set();
const approvedRead = new Set();
// pm sends touchid.reply only from here, after the fingerprint check.
const PRIVATE_METHODS = new Set(["touchid.reply"]);
let touchId = null;

function send(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("apm:event", { event, data: data === undefined ? null : data });
}

function noteSettings(snap) {
  if (snap && snap.settings && typeof snap.settings === "object") lockWatch.settings = snap.settings;
}

function noteUnlocked() {
  lockWatch.unlockedAt = lockWatch.lastActive = Date.now();
}

function lockMinutes(v, fallback) {
  return v == null || v === "" ? fallback : Number(v);
}

async function lockWithoutWindow(reason) {
  if (mainWindow || lockWatch.locking || !backend || !backend.running) return;
  lockWatch.locking = true;
  const since = lockWatch.unlockedAt;
  try {
    // vault.lock also ends the pm CLI session, so only call it when the app
    // itself holds the vault open.
    const st = await backend.call("vault.status", {}, { timeout: 5000 });
    if (st && st.unlocked && !mainWindow) await backend.call("vault.lock", { reason }, { timeout: 5000 });
    if (lockWatch.unlockedAt === since) lockWatch.unlockedAt = 0;
  } catch (err) {
  } finally {
    lockWatch.locking = false;
  }
}

function checkLockWithoutWindow() {
  if (mainWindow || !lockWatch.unlockedAt) return;
  const st = lockWatch.settings;
  const idleMin = lockMinutes(st.inactivity, 15);
  const maxMin = lockMinutes(st.sessionTimeout, 60);
  const now = Date.now();
  if (idleMin > 0 && now - lockWatch.lastActive > idleMin * 60000) lockWithoutWindow("idle");
  else if (maxMin > 0 && now - lockWatch.unlockedAt > maxMin * 60000) lockWithoutWindow("expired");
}

function userData() {
  return app.getPath("userData");
}

function defaultVaultPath() {
  return paths.resolveVaultPath({ config: {} }).path;
}

function currentConfig() {
  return paths.readConfig(userData());
}

function resolveRuntime() {
  const pm = paths.resolvePmPath({ packaged: app.isPackaged, resourcesPath: process.resourcesPath });
  pmPath = pm.path;
  pmSource = pm.source;
  vaultPath = paths.resolveVaultPath({ config: currentConfig() }).path;
}

function backendEnv() {
  const env = Object.assign({}, process.env, { APM_DESKTOP: "1" });
  if (process.platform === "darwin") env.APM_DESKTOP_TOUCHID = "app";
  return env;
}

function backendArgs() {
  return ["desktop", "--vault", vaultPath];
}

async function waitHello(tries) {
  let last = null;
  for (let i = 0; i < (tries || 40); i++) {
    try {
      return await backend.call("app.hello", {}, { timeout: 4000 });
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw last || new Error("The APM backend did not start.");
}

function startBackend() {
  resolveRuntime();
  try { paths.ensureParentDir(vaultPath); } catch (err) {}
  backend = new Backend({ command: pmPath, args: backendArgs(), env: backendEnv() });
  backend.on("event", (event, data) => {
    if (event === "touchid.prompt") { touchId.prompt(data || {}); return; }
    if (event === "touchid.cancel") { touchId.cancelInline(data && data.id); return; }
    if (event === "vault.unlocked") noteUnlocked();
    // The pairing code is approved in the app, so bring it in front of the
    // browser. A new window picks the request up from bridge.info on boot.
    if (event === "bridge.pair") showWindow({ steal: true });
    if (event === "bridge.activity") lockWatch.lastActive = Date.now();
    if (data && data.snapshot) noteSettings(data.snapshot);
    send(event, data);
  });
  backend.on("spawn", () => touchId.cancelInline());
  backend.on("log", (line) => { if (!app.isPackaged) process.stderr.write("[pm] " + line + "\n"); });
  backend.start();
}

function sanitizeFilters(filters) {
  if (!Array.isArray(filters)) return undefined;
  return filters
    .filter((f) => f && typeof f.name === "string" && Array.isArray(f.extensions))
    .map((f) => ({ name: f.name.slice(0, 80), extensions: f.extensions.filter((x) => typeof x === "string").map((x) => x.replace(/[^A-Za-z0-9*]/g, "").slice(0, 16)) }));
}

function clearClipboardIfOurs() {
  if (clip.timer) { clearTimeout(clip.timer); clip.timer = null; }
  if (clip.text !== null && clipboard.readText() === clip.text) clipboard.clear();
  clip.text = null;
}

function envelope(fn) {
  return async (...args) => {
    try {
      return { ok: true, result: await fn(...args) };
    } catch (err) {
      return { ok: false, error: toEnvelopeError(err) };
    }
  };
}

function validPath(p) {
  return typeof p === "string" && p.length > 0 && p.length < 4096 && path.isAbsolute(p) && !p.includes("\0");
}

function appInfo() {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged,
    vaultPath,
    pmPath,
    userData: userData(),
    engine: { path: pmPath, source: pmSource }
  };
}

// The pm command in /usr/local/bin always links to the pm inside the app,
// even when APM_PM_PATH points the app at another one.
function cliInstaller() {
  return new CliInstaller({
    packaged: app.isPackaged,
    bundled: app.isPackaged ? path.join(process.resourcesPath, "bin", paths.binaryName()) : pmPath,
    bundleRoot: app.isPackaged ? bundleRootFor(process.resourcesPath) : null,
    version: app.getVersion()
  });
}

async function setVaultPath(next) {
  if (!validPath(next)) {
    const err = new Error("Choose an absolute path for the vault file.");
    err.code = "invalid";
    throw err;
  }
  paths.writeConfig(userData(), { vaultPath: path.normalize(next) });
  resolveRuntime();
  try { paths.ensureParentDir(vaultPath); } catch (err) {}
  await backend.restart({ command: pmPath, args: backendArgs(), env: backendEnv() });
  await waitHello();
  send("vault.locked", { reason: "The vault location changed." });
  return appInfo();
}

function registerIpc() {
  ipcMain.handle("apm:call", envelope(async (_e, method, params) => {
    if (typeof method !== "string") {
      const err = new Error("A method name is required.");
      err.code = "invalid";
      throw err;
    }
    if (PRIVATE_METHODS.has(method)) {
      const err = new Error("That method is not available to the window.");
      err.code = "invalid";
      throw err;
    }
    const result = await backend.call(method, params === undefined ? {} : params);
    if (UNLOCK_METHODS.has(method)) noteUnlocked();
    noteSettings(method === "vault.snapshot" ? result : result && result.snapshot);
    return result;
  }));

  ipcMain.handle("apm:touchid-info", envelope(async () => ({ inline: touchId.inline })));
  ipcMain.on("apm:touchid-slot", (_e, slot) => touchId.setSlot(slot));
  ipcMain.on("apm:touchid-cancel", () => touchId.cancelInline());

  ipcMain.handle("apm:clipboard-write", envelope(async (_e, text, opts) => {
    const value = String(text === undefined || text === null ? "" : text);
    if (clip.timer) { clearTimeout(clip.timer); clip.timer = null; }
    clipboard.writeText(value);
    clip.text = value;
    const seconds = Number(opts && opts.clearAfter);
    if (seconds > 0) {
      clip.timer = setTimeout(() => {
        clip.timer = null;
        if (clip.text !== null && clipboard.readText() === clip.text) clipboard.clear();
        clip.text = null;
      }, Math.min(seconds, 86400) * 1000);
    }
    return true;
  }));

  ipcMain.handle("apm:clipboard-clear", envelope(async () => {
    clearClipboardIfOurs();
    return true;
  }));

  ipcMain.handle("apm:dialog-save", envelope(async (_e, opts) => {
    const o = opts || {};
    const r = await dialog.showSaveDialog(mainWindow, {
      title: typeof o.title === "string" ? o.title : undefined,
      defaultPath: typeof o.defaultPath === "string" ? o.defaultPath : undefined,
      filters: sanitizeFilters(o.filters),
      properties: ["createDirectory", "showOverwriteConfirmation"]
    });
    if (r.canceled || !r.filePath) return null;
    approvedWrite.add(r.filePath);
    return r.filePath;
  }));

  ipcMain.handle("apm:dialog-open", envelope(async (_e, opts) => {
    const o = opts || {};
    const properties = [o.directory ? "openDirectory" : "openFile"];
    if (o.multi) properties.push("multiSelections");
    if (o.directory) properties.push("createDirectory");
    const r = await dialog.showOpenDialog(mainWindow, {
      title: typeof o.title === "string" ? o.title : undefined,
      defaultPath: typeof o.defaultPath === "string" ? o.defaultPath : undefined,
      filters: o.directory ? undefined : sanitizeFilters(o.filters),
      properties
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return null;
    r.filePaths.forEach((p) => { approvedRead.add(p); approvedWrite.add(p); });
    return r.filePaths;
  }));

  ipcMain.handle("apm:files-write", envelope(async (_e, target, data, opts) => {
    if (!validPath(target) || !approvedWrite.has(target)) {
      const err = new Error("APM can only write to a file you picked in a save dialog.");
      err.code = "invalid";
      throw err;
    }
    const encoding = opts && opts.encoding === "base64" ? "base64" : "utf8";
    const buf = Buffer.from(String(data === undefined || data === null ? "" : data), encoding);
    fs.writeFileSync(target, buf, { mode: 0o600 });
    return { path: target, size: buf.length };
  }));

  ipcMain.handle("apm:files-read", envelope(async (_e, target) => {
    if (!validPath(target) || !approvedRead.has(target)) {
      const err = new Error("APM can only read a file you picked in an open dialog.");
      err.code = "invalid";
      throw err;
    }
    const st = fs.statSync(target);
    if (!st.isFile()) {
      const err = new Error("That is not a file.");
      err.code = "invalid";
      throw err;
    }
    if (st.size > READ_LIMIT) {
      const err = new Error("That file is larger than 50 MB.");
      err.code = "invalid";
      err.data = { size: st.size, limit: READ_LIMIT };
      throw err;
    }
    return { name: path.basename(target), size: st.size, data: fs.readFileSync(target).toString("base64") };
  }));

  ipcMain.handle("apm:shell-open", envelope(async (_e, url) => {
    let u;
    try { u = new URL(String(url)); } catch (err) { u = null; }
    if (!u || !["https:", "http:", "mailto:"].includes(u.protocol)) {
      const err = new Error("Only web and email links can be opened.");
      err.code = "invalid";
      throw err;
    }
    await shell.openExternal(u.toString());
    return true;
  }));

  ipcMain.handle("apm:shell-show", envelope(async (_e, target) => {
    if (!validPath(target) || !(approvedWrite.has(target) || approvedRead.has(target) || target === vaultPath)) {
      const err = new Error("APM can only reveal files you picked or the vault file.");
      err.code = "invalid";
      throw err;
    }
    shell.showItemInFolder(target);
    return true;
  }));

  ipcMain.handle("apm:app-info", envelope(async () => appInfo()));
  ipcMain.handle("apm:app-vault-path", envelope(async () => vaultPath));
  ipcMain.handle("apm:app-default-vault-path", envelope(async () => defaultVaultPath()));
  ipcMain.handle("apm:app-set-vault-path", envelope(async (_e, next) => setVaultPath(next)));
  ipcMain.handle("apm:app-cli-status", envelope(async () => cliInstaller().status()));
  ipcMain.handle("apm:app-cli-install", envelope(async () => cliInstaller().install()));
  ipcMain.handle("apm:app-cli-uninstall", envelope(async () => cliInstaller().uninstall()));
  ipcMain.handle("apm:app-cli-update", envelope(async () => cliInstaller().update()));
  ipcMain.handle("apm:app-relaunch", envelope(async () => { app.relaunch(); app.exit(0); return true; }));
  ipcMain.handle("apm:app-quit", envelope(async () => { setImmediate(() => app.quit()); return true; }));

  ipcMain.on("apm:menu-state", (_e, state) => {
    const s = state || {};
    menuState = { locked: !!s.locked, hasSelection: !!s.hasSelection };
    applyMenu();
  });
}

function applyMenu() {
  Menu.setApplicationMenu(buildMenu({
    state: menuState,
    packaged: app.isPackaged,
    platform: process.platform,
    appName: APP_NAME,
    action: (name) => send("menu", { action: name }),
    openExternal: (url) => shell.openExternal(url)
  }));
}

function applyAbout() {
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
  try { app.setAboutPanelOptions(aboutOptions({ version: app.getVersion(), iconPath: fs.existsSync(iconPath) ? iconPath : undefined })); } catch (err) {}
}

function registerProtocol() {
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response("Not found", { status: 404 });
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const filePath = path.resolve(DIST, "." + pathname);
    if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(filePath).toString()).then((res) => {
      const headers = new Headers(res.headers);
      headers.set("cache-control", "no-store");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    });
  });
}

function lockDownSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
}

// build/icon-dev.png is AppIcon.icon rendered by `npm run icon:dev`.
function devIcon() {
  const rendered = path.join(__dirname, "..", "build", "icon-dev.png");
  return fs.existsSync(rendered) ? rendered : path.join(__dirname, "..", "build", "icon.png");
}

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 560,
    title: "APM",
    show: false,
    backgroundColor: dark ? "#09090b" : "#ffffff",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    ...(app.isPackaged ? {} : { icon: devIcon() }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  });
  const origin = SCHEME + "://" + HOST;
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (["https:", "http:", "mailto:"].includes(u.protocol)) shell.openExternal(u.toString());
    } catch (err) {}
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin + "/")) {
      event.preventDefault();
      try {
        const u = new URL(url);
        if (["https:", "http:"].includes(u.protocol)) shell.openExternal(u.toString());
      } catch (err) {}
    }
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  if (!app.isPackaged) {
    mainWindow.webContents.on("console-message", (e) => {
      if (e.level === "error" || e.level === "warning") process.stderr.write("[renderer " + e.level + "] " + String(e.message).slice(0, 2000) + "\n");
    });
  }
  mainWindow.loadURL(origin + "/index.html");
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("blur", () => touchId.cancelInline());
  mainWindow.webContents.on("did-start-navigation", (e) => { if (e.isMainFrame && !e.isSameDocument) { touchId.setSlot(null); touchId.cancelInline(); } });
  mainWindow.on("closed", () => { touchId.setSlot(null); touchId.cancelInline(); mainWindow = null; lockWatch.lastActive = Date.now(); });
}

function onSleep(state) {
  send("power", { state });
  if (!mainWindow && lockWatch.unlockedAt && lockWatch.settings.lockOnSleep !== false) lockWithoutWindow("sleep");
}

function showWindow(opts) {
  if (!mainWindow) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  if (opts && opts.steal && process.platform === "darwin") app.focus({ steal: true });
}

function watchPower() {
  powerMonitor.on("suspend", () => onSleep("suspend"));
  powerMonitor.on("lock-screen", () => onSleep("lock-screen"));
  idleTimer = setInterval(() => {
    let seconds = 0;
    try { seconds = powerMonitor.getSystemIdleTime(); } catch (err) { seconds = 0; }
    if (seconds >= IDLE_MIN_SECONDS) send("power", { state: "idle", seconds });
  }, IDLE_POLL_MS);
  lockTimer = setInterval(checkLockWithoutWindow, LOCK_POLL_MS);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());

  app.whenReady().then(() => {
    // A packaged app gets its icon from Assets.car, which macOS 26+ draws with
    // the system glass, shadow and icon styles. Never set a Dock image there: a
    // bitmap replaces all of that. In development Electron.app would otherwise
    // show the Electron icon.
    if (!app.isPackaged && process.platform === "darwin" && app.dock) {
      try { app.dock.setIcon(devIcon()); } catch (err) {}
    }
    touchId = new TouchId({
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      window: () => mainWindow,
      reply: (payload) => backend.call("touchid.reply", payload, { timeout: 5000 }),
      notify: (on) => send("touchid.inline", { on })
    });
    lockDownSession();
    registerProtocol();
    registerIpc();
    startBackend();
    applyAbout();
    applyMenu();
    createWindow();
    watchPower();
    app.on("activate", () => { if (!mainWindow) createWindow(); });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  let quitting = false;
  app.on("before-quit", (event) => {
    if (quitting) return;
    quitting = true;
    clearClipboardIfOurs();
    if (idleTimer) clearInterval(idleTimer);
    if (lockTimer) clearInterval(lockTimer);
    if (backend && backend.running) {
      event.preventDefault();
      backend.stop().finally(() => app.quit());
    }
  });
}
