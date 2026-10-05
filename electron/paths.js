"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const GUI_ROOT = path.join(__dirname, "..");

function defaultExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch (err) {
    return false;
  }
}

function binaryName(platform) {
  return (platform || process.platform) === "win32" ? "pm.exe" : "pm";
}

function findOnPath(name, envPath, exists, platform) {
  const plat = platform || process.platform;
  const check = exists || defaultExists;
  const sep = plat === "win32" ? ";" : ":";
  const dirs = String(envPath || "").split(sep).filter(Boolean);
  const names = plat === "win32" && !/\.exe$/i.test(name) ? [name + ".exe", name] : [name];
  for (const dir of dirs) {
    for (const n of names) {
      const candidate = path.join(dir, n);
      if (check(candidate)) return candidate;
    }
  }
  return null;
}

function resolvePmPath(opts) {
  const o = opts || {};
  const env = o.env || process.env;
  const exists = o.exists || defaultExists;
  const platform = o.platform || process.platform;
  const bin = binaryName(platform);
  const guiRoot = o.guiRoot || GUI_ROOT;
  if (env.APM_PM_PATH) return { path: path.resolve(env.APM_PM_PATH), source: "env" };
  // The packaged app runs only the pm it ships with, which has the app's
  // version. A dev build or an older pm on PATH is never picked up.
  if (o.packaged) {
    const bundled = o.resourcesPath ? path.join(o.resourcesPath, "bin", bin) : null;
    if (bundled && exists(bundled)) return { path: bundled, source: "bundled" };
    return { path: null, source: "missing" };
  }
  const dev = path.join(guiRoot, "bin", bin);
  if (exists(dev)) return { path: dev, source: "dev" };
  const onPath = findOnPath("pm", env.PATH, exists, platform);
  if (onPath) return { path: onPath, source: "path" };
  return { path: null, source: "missing" };
}

function resolveVaultPath(opts) {
  const o = opts || {};
  const env = o.env || process.env;
  const exists = o.exists || defaultExists;
  const home = o.home || os.homedir();
  const platform = o.platform || process.platform;
  const config = o.config || {};
  if (config.vaultPath && path.isAbsolute(config.vaultPath)) return { path: path.normalize(config.vaultPath), source: "config" };
  const onPath = o.pmOnPath !== undefined ? o.pmOnPath : findOnPath("pm", env.PATH, exists, platform);
  if (env.APM_VAULT_PATH) {
    const raw = env.APM_VAULT_PATH;
    if (path.isAbsolute(raw)) return { path: path.normalize(raw), source: "env" };
    return { path: path.resolve(onPath ? path.dirname(onPath) : home, raw), source: "env" };
  }
  // pm keeps its vault next to itself only when one is there. The pm command
  // the app installs is a symlink in /usr/local/bin with no vault beside it,
  // and that pm falls through to ~/.apm/vault.dat just like this does.
  if (onPath && exists(path.join(path.dirname(onPath), "vault.dat"))) return { path: path.join(path.dirname(onPath), "vault.dat"), source: "pm" };
  const legacy = path.join(home, "Desktop", "apm", "vault.dat");
  if (exists(legacy)) return { path: legacy, source: "legacy" };
  return { path: path.join(home, ".apm", "vault.dat"), source: "default" };
}

function configFile(userDataDir) {
  return path.join(userDataDir, "config.json");
}

function readConfig(userDataDir) {
  try {
    const raw = fs.readFileSync(configFile(userDataDir), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    return {};
  }
}

function writeConfig(userDataDir, patch) {
  const next = Object.assign({}, readConfig(userDataDir), patch || {});
  fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
  const file = configFile(userDataDir);
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
  return next;
}

function ensureParentDir(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

module.exports = { GUI_ROOT, binaryName, findOnPath, resolvePmPath, resolveVaultPath, readConfig, writeConfig, configFile, ensureParentDir };
