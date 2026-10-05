"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const paths = require("../electron/paths");

const fakeFs = (files) => (p) => files.includes(p);

test("pm binary: env wins, then bundled, then dev, then PATH", () => {
  const files = ["/res/bin/pm", "/gui/bin/pm", "/usr/local/bin/pm"];
  const exists = fakeFs(files);
  const base = { guiRoot: "/gui", resourcesPath: "/res", exists, platform: "darwin" };
  assert.deepEqual(paths.resolvePmPath({ ...base, env: { APM_PM_PATH: "/custom/pm", PATH: "/usr/local/bin" } }), { path: "/custom/pm", source: "env" });
  assert.deepEqual(paths.resolvePmPath({ ...base, packaged: true, env: { APM_PM_PATH: "/custom/pm", PATH: "/usr/local/bin" } }), { path: "/custom/pm", source: "env" });
  assert.deepEqual(paths.resolvePmPath({ ...base, packaged: true, env: { PATH: "/usr/local/bin" } }), { path: "/res/bin/pm", source: "bundled" });
  assert.deepEqual(paths.resolvePmPath({ ...base, packaged: false, env: { PATH: "/usr/local/bin" } }), { path: "/gui/bin/pm", source: "dev" });
  assert.deepEqual(paths.resolvePmPath({ ...base, exists: fakeFs(["/usr/local/bin/pm"]), env: { PATH: "/usr/bin:/usr/local/bin" } }), { path: "/usr/local/bin/pm", source: "path" });
  assert.deepEqual(paths.resolvePmPath({ ...base, exists: fakeFs([]), env: { PATH: "/usr/bin" } }), { path: null, source: "missing" });
});

test("packaged app never falls back to a dev build or PATH", () => {
  const base = { guiRoot: "/gui", resourcesPath: "/res", platform: "darwin", packaged: true, env: { PATH: "/usr/local/bin" } };
  const missing = { path: null, source: "missing" };
  assert.deepEqual(paths.resolvePmPath({ ...base, exists: fakeFs(["/gui/bin/pm", "/usr/local/bin/pm"]) }), missing);
  assert.deepEqual(paths.resolvePmPath({ ...base, resourcesPath: undefined, exists: fakeFs(["/gui/bin/pm", "/usr/local/bin/pm"]) }), missing);
  assert.deepEqual(paths.resolvePmPath({ ...base, platform: "win32", exists: fakeFs([path.join("/res", "bin", "pm.exe")]) }), { path: path.join("/res", "bin", "pm.exe"), source: "bundled" });
});

test("pm binary on Windows looks for pm.exe", () => {
  const found = paths.findOnPath("pm", "C:\\tools;C:\\bin", fakeFs([path.join("C:\\bin", "pm.exe")]), "win32");
  assert.equal(found, path.join("C:\\bin", "pm.exe"));
});

test("vault path: config, env, pm on PATH, legacy, default", () => {
  const home = "/Users/me";
  const legacy = "/Users/me/Desktop/apm/vault.dat";
  const r = (o) => paths.resolveVaultPath(Object.assign({ home, platform: "darwin", exists: fakeFs([]), env: {} }, o));
  assert.deepEqual(r({ config: { vaultPath: "/v/saved.dat" }, env: { APM_VAULT_PATH: "/v/env.dat" } }), { path: "/v/saved.dat", source: "config" });
  assert.deepEqual(r({ config: { vaultPath: "relative.dat" }, env: { APM_VAULT_PATH: "/v/env.dat" } }), { path: "/v/env.dat", source: "env" });
  assert.deepEqual(r({ env: { APM_VAULT_PATH: "vaults/a.dat" }, pmOnPath: "/opt/bin/pm" }), { path: "/opt/bin/vaults/a.dat", source: "env" });
  assert.deepEqual(r({ env: { APM_VAULT_PATH: "a.dat" }, pmOnPath: null }), { path: "/Users/me/a.dat", source: "env" });
  assert.deepEqual(r({ env: { PATH: "/opt/bin" }, exists: fakeFs(["/opt/bin/pm", "/opt/bin/vault.dat", legacy]) }), { path: "/opt/bin/vault.dat", source: "pm" });
  // The pm command the app installs has no vault beside it.
  assert.deepEqual(r({ env: { PATH: "/usr/local/bin" }, exists: fakeFs(["/usr/local/bin/pm"]) }), { path: "/Users/me/.apm/vault.dat", source: "default" });
  assert.deepEqual(r({ env: { PATH: "/opt/bin" }, exists: fakeFs(["/opt/bin/pm", legacy]) }), { path: legacy, source: "legacy" });
  assert.deepEqual(r({ exists: fakeFs([legacy]) }), { path: legacy, source: "legacy" });
  assert.deepEqual(r({}), { path: "/Users/me/.apm/vault.dat", source: "default" });
});

test("config round trips through userData/config.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apm-paths-test-"));
  try {
    assert.deepEqual(paths.readConfig(dir), {});
    paths.writeConfig(dir, { vaultPath: "/a/vault.dat" });
    paths.writeConfig(dir, { other: 1 });
    assert.deepEqual(paths.readConfig(dir), { vaultPath: "/a/vault.dat", other: 1 });
    fs.writeFileSync(paths.configFile(dir), "{broken");
    assert.deepEqual(paths.readConfig(dir), {});
    const nested = path.join(dir, "deep", "er", "vault.dat");
    paths.ensureParentDir(nested);
    assert.ok(fs.statSync(path.dirname(nested)).isDirectory());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
