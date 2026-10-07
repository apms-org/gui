// npm run dev:watch: runs the app and keeps it current while you edit.
//
// - renderer/ and the design system: rebuilt on save, and the open windows
//   reload (through Chrome DevTools Protocol on a loopback port).
// - electron/: the app restarts.
// - ../CLI (*.go): pm is rebuilt, then the app restarts.
// - native/touchid.mm: the Touch ID module is rebuilt, then the app restarts.
//
// The vault locks when the app restarts, like any relaunch. Ctrl+C stops everything.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.resolve(root, "..", "CLI");
const ds = path.resolve(root, "..", "design-system");
const PORT = Number(process.env.APM_DEV_DEVTOOLS_PORT) || 9333;
const electronBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron");

const log = (...a) => console.log("\x1b[2m[dev]\x1b[0m", ...a);

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: root, stdio: "inherit", ...opts });
    p.on("exit", (code) => resolve(code === 0));
  });
}

const node = (script, ...args) => run(process.execPath, [path.join(root, "scripts", script), ...args]);

let app = null;
let stopping = false;
let restarting = false;

function startApp() {
  app = spawn(electronBin, [".", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=" + PORT], { cwd: root, stdio: "inherit" });
  const self = app;
  self.on("exit", () => {
    if (app !== self) return;
    app = null;
    if (!stopping && !restarting) { log("app closed. Ctrl+C to stop watching, or save a file to start it again."); }
  });
}

async function restartApp(why) {
  if (restarting) return;
  restarting = true;
  log(why + ", restarting the app");
  if (app) {
    const p = app;
    await new Promise((resolve) => { p.once("exit", resolve); p.kill(); setTimeout(resolve, 4000); });
  }
  restarting = false;
  if (!stopping) startApp();
}

// Reloads every page the app has open, through DevTools on the loopback port.
async function reloadPages() {
  if (!app) { startApp(); return; }
  let targets;
  try { targets = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json(); } catch (err) { return; }
  for (const t of targets) {
    if (t.type !== "page" || !t.webSocketDebuggerUrl) continue;
    await new Promise((resolve) => {
      const ws = new WebSocket(t.webSocketDebuggerUrl);
      const done = () => { try { ws.close(); } catch (err) {} resolve(); };
      ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Page.reload", params: { ignoreCache: true } }));
      ws.onmessage = done;
      ws.onerror = done;
      setTimeout(done, 1500);
    });
  }
  log("reloaded");
}

function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function watch(dir, filter, fn) {
  if (!fs.existsSync(dir)) return;
  fs.watch(dir, { recursive: true }, (_e, file) => { if (file && filter(String(file))) fn(String(file)); });
}

let building = Promise.resolve();
const serial = (job) => (building = building.then(job, job));

async function main() {
  log("building pm and the Touch ID module");
  if (!(await node("build-backend.mjs"))) log("pm build failed; the app will run with the last good build");
  await node("build-native.mjs", "--optional");

  // The renderer watcher writes dist/; it runs for as long as this does.
  const renderer = spawn(process.execPath, [path.join(root, "scripts", "build-renderer.mjs"), "--watch"], { cwd: root, stdio: "inherit" });
  await new Promise((r) => setTimeout(r, 1500));
  startApp();

  const reload = debounce(reloadPages, 250);
  watch(path.join(root, "dist"), (f) => !f.endsWith(".map"), reload);

  watch(path.join(root, "electron"), (f) => f.endsWith(".js"), debounce((f) => restartApp("electron/" + f + " changed"), 300));
  watch(path.join(root, "native"), (f) => f.endsWith(".mm"), debounce(() => serial(async () => {
    log("rebuilding the Touch ID module");
    if (await node("build-native.mjs", "--optional")) await restartApp("Touch ID module rebuilt");
  }), 300));
  watch(cli, (f) => f.endsWith(".go") || f.endsWith(".json") || f.includes("mcpprompt"), debounce((f) => serial(async () => {
    log("CLI/" + f + " changed, rebuilding pm");
    if (await node("build-backend.mjs")) await restartApp("pm rebuilt");
    else log("pm build failed; keeping the running app");
  }), 600));
  if (fs.existsSync(ds)) log("watching renderer/, design-system/, electron/, native/ and ../CLI");

  const stop = () => {
    stopping = true;
    try { renderer.kill(); } catch (err) {}
    try { if (app) app.kill(); } catch (err) {}
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main();
