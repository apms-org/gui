import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Backend, toEnvelopeError } = require("../electron/backend.js");
const paths = require("../electron/paths.js");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function arg(name) {
  const i = process.argv.indexOf("--" + name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith("--" + name + "="));
  return eq ? eq.slice(name.length + 3) : undefined;
}
const flag = (name) => process.argv.includes("--" + name);

const port = Number(arg("port") || process.env.PORT || 4417);
const sandbox = path.resolve(arg("dir") || process.env.APM_WEB_BRIDGE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "apm-web-bridge-")));
const inheritHome = flag("inherit-home");
const files = path.join(sandbox, "files");
fs.mkdirSync(files, { recursive: true, mode: 0o700 });

let vaultPath = path.resolve(arg("vault") || process.env.APM_VAULT_PATH || path.join(sandbox, "vault.dat"));
const pm = paths.resolvePmPath({ packaged: false });
const pmPath = pm.path;

function backendEnv() {
  const env = { ...process.env, APM_DESKTOP: "1" };
  if (!inheritHome) {
    const home = path.join(sandbox, "home");
    const tmp = path.join(sandbox, "tmp");
    fs.mkdirSync(home, { recursive: true, mode: 0o700 });
    fs.mkdirSync(tmp, { recursive: true, mode: 0o700 });
    env.HOME = home;
    env.USERPROFILE = home;
    env.APPDATA = path.join(home, "AppData", "Roaming");
    env.LOCALAPPDATA = path.join(home, "AppData", "Local");
    env.XDG_CONFIG_HOME = path.join(home, ".config");
    env.XDG_CACHE_HOME = path.join(home, ".cache");
    env.XDG_DATA_HOME = path.join(home, ".local", "share");
    env.TMPDIR = tmp;
    env.TMP = tmp;
    env.TEMP = tmp;
  }
  return env;
}

const backend = new Backend({ command: pmPath, args: ["desktop", "--vault", vaultPath], env: backendEnv() });
const clients = new Set();
const state = { clipboard: [], opened: [], revealed: [], menu: { locked: true, hasSelection: false }, events: [] };

function broadcast(event, data) {
  const frame = "data: " + JSON.stringify({ event, data: data === undefined ? null : data }) + "\n\n";
  state.events.push({ ts: Date.now(), event });
  if (state.events.length > 200) state.events.shift();
  for (const res of clients) {
    try { res.write(frame); } catch (err) {}
  }
}

backend.on("event", (event, data) => broadcast(event, data));
backend.on("log", (line) => process.stderr.write("[pm] " + line + "\n"));

function inSandbox(p) {
  if (typeof p !== "string" || !p) return null;
  const resolved = path.resolve(files, p);
  if (resolved !== files && !resolved.startsWith(files + path.sep)) return null;
  return resolved;
}

function fail(code, message, data) {
  const err = new Error(message);
  err.code = code;
  if (data !== undefined) err.data = data;
  throw err;
}

async function waitHello() {
  let last = null;
  for (let i = 0; i < 40; i++) {
    try {
      return await backend.call("app.hello", {}, { timeout: 4000 });
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw last || new Error("The APM backend did not start.");
}

function info() {
  return { version: pkg.version, platform: process.platform, arch: process.arch, packaged: false, vaultPath, pmPath, userData: sandbox, mode: "web" };
}

const NATIVE = {
  "clipboard.write": (text, opts) => {
    state.clipboard.push({ text: String(text === undefined || text === null ? "" : text), clearAfter: Number(opts && opts.clearAfter) || 0, ts: Date.now() });
    if (state.clipboard.length > 50) state.clipboard.shift();
    return true;
  },
  "clipboard.clear": () => {
    state.clipboard.push({ text: "", cleared: true, ts: Date.now() });
    return true;
  },
  "dialog.save": (opts) => {
    const name = path.basename(String((opts && opts.defaultPath) || "export.txt")).replace(/[^\w.\-]/g, "_") || "export.txt";
    return path.join(files, Date.now() + "-" + name);
  },
  "dialog.open": (opts) => {
    if (opts && opts.directory) return [files];
    const list = fs.readdirSync(files).map((n) => path.join(files, n)).filter((p) => fs.statSync(p).isFile());
    if (!list.length) return null;
    list.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return opts && opts.multi ? list : [list[0]];
  },
  "files.write": (target, data, opts) => {
    const p = inSandbox(target);
    if (!p) fail("invalid", "The web bridge only writes inside " + files + ".");
    const buf = Buffer.from(String(data === undefined || data === null ? "" : data), opts && opts.encoding === "base64" ? "base64" : "utf8");
    fs.writeFileSync(p, buf, { mode: 0o600 });
    return { path: p, size: buf.length };
  },
  "files.read": (target) => {
    const p = inSandbox(target);
    if (!p || !fs.existsSync(p)) fail("invalid", "The web bridge only reads inside " + files + ".");
    const st = fs.statSync(p);
    if (st.size > 50 * 1024 * 1024) fail("invalid", "That file is larger than 50 MB.", { size: st.size });
    return { name: path.basename(p), size: st.size, data: fs.readFileSync(p).toString("base64") };
  },
  "shell.openExternal": (url) => { state.opened.push(String(url)); return true; },
  "shell.showItemInFolder": (p) => { state.revealed.push(String(p)); return true; },
  "app.info": () => info(),
  "app.getVaultPath": () => vaultPath,
  "app.defaultVaultPath": () => path.join(sandbox, "vault.dat"),
  "app.setVaultPath": async (next) => {
    if (typeof next !== "string" || !path.isAbsolute(next)) fail("invalid", "Choose an absolute path for the vault file.");
    const resolved = path.resolve(next);
    if (resolved !== path.join(sandbox, path.basename(resolved)) && !resolved.startsWith(sandbox + path.sep)) fail("invalid", "The web bridge keeps vaults inside " + sandbox + ".");
    fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
    vaultPath = resolved;
    await backend.restart({ args: ["desktop", "--vault", vaultPath], env: backendEnv() });
    await waitHello();
    broadcast("vault.locked", { reason: "The vault location changed." });
    return info();
  },
  "app.relaunch": async () => {
    await backend.restart();
    await waitHello();
    broadcast("vault.locked", { reason: "Relaunched." });
    return true;
  },
  "app.quit": () => true,
  "menu.setState": (s) => { state.menu = { locked: !!(s && s.locked), hasSelection: !!(s && s.hasSelection) }; return true; }
};

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".map": "application/json" };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 120 * 1024 * 1024) { reject(new Error("Request too large.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.resolve(dist, "." + rel);
  if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  try {
    if (req.method === "POST" && url.pathname === "/rpc") {
      const body = await readBody(req);
      try {
        const result = await backend.call(body.method, body.params === undefined ? {} : body.params);
        sendJson(res, 200, { result: result === undefined ? null : result });
      } catch (err) {
        sendJson(res, 200, { error: toEnvelopeError(err) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/native") {
      const body = await readBody(req);
      const fn = NATIVE[body.op];
      if (!fn) { sendJson(res, 200, { error: { code: "unsupported", message: "Unknown native op " + body.op + "." } }); return; }
      try {
        const result = await fn(...(Array.isArray(body.args) ? body.args : []));
        sendJson(res, 200, { result: result === undefined ? null : result });
      } catch (err) {
        sendJson(res, 200, { error: toEnvelopeError(err) });
      }
      return;
    }
    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(": connected\n\n");
      clients.add(res);
      const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch (err) {} }, 15000);
      req.on("close", () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (req.method === "GET" && url.pathname === "/clipboard") {
      const last = state.clipboard[state.clipboard.length - 1] || null;
      sendJson(res, 200, { text: last ? last.text : "", last, history: state.clipboard });
      return;
    }
    if (req.method === "GET" && url.pathname === "/state") {
      sendJson(res, 200, { info: info(), menu: state.menu, opened: state.opened, revealed: state.revealed, events: state.events, files, sandbox, running: backend.running });
      return;
    }
    if (req.method === "POST" && url.pathname === "/test/menu") {
      const body = await readBody(req);
      broadcast("menu", { action: String(body.action || "") });
      sendJson(res, 200, { result: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/test/power") {
      const body = await readBody(req);
      broadcast("power", Object.assign({ state: String(body.state || "suspend") }, body.seconds ? { seconds: Number(body.seconds) } : {}));
      sendJson(res, 200, { result: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/test/event") {
      const body = await readBody(req);
      broadcast(String(body.event || ""), body.data);
      sendJson(res, 200, { result: true });
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") { serveStatic(req, res, url.pathname); return; }
    res.writeHead(405); res.end();
  } catch (err) {
    sendJson(res, 500, { error: { code: "internal", message: err.message } });
  }
});

function shutdown() {
  for (const res of clients) { try { res.end(); } catch (err) {} }
  server.close();
  backend.stop(800).finally(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (!fs.existsSync(path.join(dist, "index.html"))) console.error("dist/index.html is missing. Run npm run build first.");
if (!pmPath) console.error("The pm binary was not found. Run npm run build:backend or set APM_PM_PATH.");
backend.start();
server.listen(port, "127.0.0.1", () => {
  console.log("APM web bridge on http://127.0.0.1:" + port);
  console.log("vault " + vaultPath);
  console.log("sandbox " + sandbox + (inheritHome ? " (inheriting HOME and TMPDIR)" : " (isolated HOME and TMPDIR)"));
  console.log("pm " + (pmPath || "missing") + (pm.source ? " (" + pm.source + ")" : ""));
});
