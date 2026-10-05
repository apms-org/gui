"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CliInstaller, UNSUPPORTED, shellQuote, appleScriptString, bundleRootFor } = require("../electron/cli-install");

function sandbox(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "apm-cli-install-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const res = path.join(dir, "APM.app", "Contents", "Resources");
  const bundled = path.join(res, "bin", "pm");
  fs.mkdirSync(path.dirname(bundled), { recursive: true });
  fs.writeFileSync(bundled, "#!/bin/sh\n", { mode: 0o755 });
  const binDir = path.join(dir, "usr-local-bin");
  return { dir, res, bundled, binDir, link: path.join(binDir, "pm") };
}

function make(s, o) {
  return new CliInstaller(Object.assign({
    platform: "darwin",
    packaged: true,
    bundled: s.bundled,
    bundleRoot: bundleRootFor(s.res),
    version: "12.0.0",
    link: s.link,
    pathDirs: [s.binDir, "/usr/bin"],
    shell: null,
    readVersion: async (p) => (fs.realpathSync(p) === s.bundled ? "12.0.0" : "11.2.0")
  }, o || {}));
}

test("unsupported outside the packaged macOS app", async (t) => {
  const s = sandbox(t);
  for (const o of [{ packaged: false }, { platform: "linux" }, { platform: "win32" }]) {
    const c = make(s, o);
    const st = await c.status();
    assert.equal(st.supported, false);
    assert.equal(st.reason, UNSUPPORTED);
    assert.equal(st.installed, false);
    await assert.rejects(c.install(), { code: "unsupported" });
    await assert.rejects(c.uninstall(), { code: "unsupported" });
  }
  assert.equal(fs.existsSync(s.link), false);
});

test("install creates the link, the folder, and is idempotent", async (t) => {
  const s = sandbox(t);
  const c = make(s);
  assert.deepEqual(await c.status(), { link: s.link, bundled: s.bundled, version: "12.0.0", supported: true, state: "missing", installed: false, found: null, conflict: null });
  const st = await c.install();
  assert.equal(st.installed, true);
  assert.equal(st.conflict, null);
  assert.equal(fs.readlinkSync(s.link), s.bundled);
  assert.equal((await c.install()).installed, true);
  assert.deepEqual(fs.readdirSync(s.binDir), ["pm"]);
});

test("install replaces another symlink but never a regular file", async (t) => {
  const s = sandbox(t);
  const other = path.join(s.dir, "other-pm");
  fs.writeFileSync(other, "old", { mode: 0o755 });
  fs.mkdirSync(s.binDir);
  fs.symlinkSync(other, s.link);
  const c = make(s);
  assert.match((await c.status()).conflict, /links to .*other-pm/);
  assert.equal((await c.install()).installed, true);
  assert.equal(fs.readlinkSync(s.link), s.bundled);

  fs.unlinkSync(s.link);
  fs.writeFileSync(s.link, "a real pm", { mode: 0o755 });
  assert.match((await c.status()).conflict, /file APM did not install/);
  await assert.rejects(c.install(), { code: "conflict" });
  assert.equal(fs.readFileSync(s.link, "utf8"), "a real pm");
});

test("reports a different pm earlier on PATH", async (t) => {
  const s = sandbox(t);
  const early = path.join(s.dir, "early");
  fs.mkdirSync(early);
  fs.writeFileSync(path.join(early, "pm"), "brew pm", { mode: 0o755 });
  const late = path.join(s.dir, "late");
  fs.mkdirSync(late);
  fs.writeFileSync(path.join(late, "pm"), "ignored", { mode: 0o755 });
  const c = make(s, { pathDirs: [early, s.binDir, late] });
  await c.install();
  const st = await c.status();
  assert.equal(st.installed, true);
  assert.equal(st.conflict, path.join(early, "pm") + " comes first on your PATH, so a terminal runs that pm instead.");
  // A link to the same bundled pm ahead on PATH is not a conflict.
  fs.rmSync(path.join(early, "pm"));
  fs.symlinkSync(s.bundled, path.join(early, "pm"));
  assert.equal((await c.status()).conflict, null);
});

test("uninstall removes only a link into this app", async (t) => {
  const s = sandbox(t);
  const c = make(s);
  assert.equal((await c.uninstall()).installed, false);
  await c.install();
  const st = await c.uninstall();
  assert.equal(st.installed, false);
  assert.equal(fs.existsSync(s.link), false);

  const other = path.join(s.dir, "other-pm");
  fs.writeFileSync(other, "old", { mode: 0o755 });
  fs.symlinkSync(other, s.link);
  await assert.rejects(c.uninstall(), { code: "conflict" });
  assert.equal(fs.readlinkSync(s.link), other);

  fs.unlinkSync(s.link);
  fs.writeFileSync(s.link, "a real pm");
  await assert.rejects(c.uninstall(), { code: "conflict" });
  assert.equal(fs.readFileSync(s.link, "utf8"), "a real pm");
});

function deniedFs(codes) {
  // Real fs, except writes in the link folder fail the way /usr/local/bin does.
  return Object.assign({}, fs, {
    mkdirSync: () => { const e = new Error("denied"); e.code = codes; throw e; },
    symlinkSync: () => { const e = new Error("denied"); e.code = codes; throw e; },
    unlinkSync: () => { const e = new Error("denied"); e.code = codes; throw e; }
  });
}

test("falls back to an administrator prompt with quoted paths", async (t) => {
  const s = sandbox(t);
  const calls = [];
  const exec = async (file, args) => {
    calls.push([file, args]);
    fs.mkdirSync(s.binDir, { recursive: true });
    fs.symlinkSync(s.bundled, s.link);
    return { stdout: "", stderr: "" };
  };
  const c = make(s, { fs: deniedFs("EACCES"), exec });
  const st = await c.install();
  assert.equal(st.installed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/usr/bin/osascript");
  assert.equal(calls[0][1][0], "-e");
  const script = calls[0][1][1];
  assert.match(script, /^do shell script ".*" with administrator privileges$/);
  assert.ok(script.includes("ln -sfn " + shellQuote(s.bundled) + " " + shellQuote(s.link)));
  assert.ok(script.includes("mkdir -p " + shellQuote(s.binDir)));

  const removed = [];
  const c2 = make(s, { fs: deniedFs("EPERM"), exec: async (file, args) => { removed.push(args[1]); fs.unlinkSync(s.link); return {}; } });
  assert.equal((await c2.uninstall()).installed, false);
  assert.match(removed[0], /rm -f/);
});

test("a cancelled administrator prompt is reported as cancelled", async (t) => {
  const s = sandbox(t);
  const exec = async () => { const e = new Error("Command failed"); e.stderr = "execution error: User canceled. (-128)"; throw e; };
  await assert.rejects(make(s, { fs: deniedFs("EACCES"), exec }).install(), { code: "cancelled" });
  const other = async () => { const e = new Error("Command failed"); e.stderr = "something else"; throw e; };
  await assert.rejects(make(s, { fs: deniedFs("EACCES"), exec: other }).install(), { code: "permission" });
});

test("other fs errors are not retried as administrator", async (t) => {
  const s = sandbox(t);
  let ran = false;
  const c = make(s, { fs: deniedFs("EROFS"), exec: async () => { ran = true; } });
  await assert.rejects(c.install(), { code: "EROFS" });
  assert.equal(ran, false);
});

test("quoting survives quotes, spaces and backslashes", () => {
  assert.equal(shellQuote("/Applications/My APM.app"), "'/Applications/My APM.app'");
  assert.equal(shellQuote("it's"), "'it'\\''s'");
  assert.equal(appleScriptString('a "b" \\c'), '"a \\"b\\" \\\\c"');
  assert.equal(bundleRootFor("/Applications/APM.app/Contents/Resources"), "/Applications/APM.app");
});

test("states: missing, current, outdated, newer, homebrew", async (t) => {
  const s = sandbox(t);
  fs.mkdirSync(s.binDir);
  const versions = {};
  const c = make(s, { readVersion: async (p) => versions[p] || null });
  assert.equal((await c.status()).state, "missing");

  await c.install();
  let st = await c.status();
  assert.equal(st.state, "current");
  assert.equal(st.found.ours, true);
  assert.equal(st.found.version, "12.0.0");

  const own = path.join(s.dir, "own");
  fs.mkdirSync(own);
  const mine = path.join(own, "pm");
  fs.writeFileSync(mine, "x", { mode: 0o755 });
  const c2 = make(s, { pathDirs: [own, s.binDir], readVersion: async (p) => versions[p] || null });
  versions[mine] = "12.0.0";
  assert.equal((await c2.status()).state, "current");
  versions[mine] = "11.2.0";
  st = await c2.status();
  assert.equal(st.state, "outdated");
  assert.deepEqual(st.found, { path: mine, ours: false, symlink: false, homebrew: false, version: "11.2.0" });
  versions[mine] = null;
  assert.equal((await c2.status()).state, "outdated");
  versions[mine] = "12.1.0";
  assert.equal((await c2.status()).state, "newer");

  const cellar = path.join(s.dir, "Cellar", "pm", "11.0.0", "bin");
  fs.mkdirSync(cellar, { recursive: true });
  fs.writeFileSync(path.join(cellar, "pm"), "brew", { mode: 0o755 });
  const brewBin = path.join(s.dir, "homebrew-bin");
  fs.mkdirSync(brewBin);
  fs.symlinkSync(path.join(cellar, "pm"), path.join(brewBin, "pm"));
  const c3 = make(s, { pathDirs: [brewBin, s.binDir], readVersion: async () => "11.0.0" });
  st = await c3.status();
  assert.equal(st.state, "homebrew");
  assert.equal(st.found.homebrew, true);
  await assert.rejects(c3.update(), { code: "homebrew" });
  assert.equal(fs.readlinkSync(path.join(brewBin, "pm")), path.join(cellar, "pm"));
});

test("update points an older pm at the app's copy in place", async (t) => {
  const s = sandbox(t);
  // An old symlinked pm, like ~/.apm/pm next to its vault.
  const home = path.join(s.dir, "dot-apm");
  fs.mkdirSync(home);
  const oldBuild = path.join(s.dir, "old-build");
  fs.writeFileSync(oldBuild, "old", { mode: 0o755 });
  fs.symlinkSync(oldBuild, path.join(home, "pm"));
  fs.writeFileSync(path.join(home, "vault.dat"), "vault");
  const c = make(s, { pathDirs: [home, s.binDir] });
  assert.equal((await c.status()).state, "outdated");
  let st = await c.update();
  assert.equal(st.state, "current");
  assert.equal(fs.readlinkSync(path.join(home, "pm")), s.bundled);
  assert.deepEqual(fs.readdirSync(home).sort(), ["pm", "vault.dat"]);
  assert.equal((await c.update()).state, "current");

  // A plain old binary is kept beside it as pm.old.
  const plain = path.join(s.dir, "plain");
  fs.mkdirSync(plain);
  fs.writeFileSync(path.join(plain, "pm"), "plain old pm", { mode: 0o755 });
  const c2 = make(s, { pathDirs: [plain, s.binDir] });
  st = await c2.update();
  assert.equal(st.state, "current");
  assert.equal(fs.readlinkSync(path.join(plain, "pm")), s.bundled);
  assert.equal(fs.readFileSync(path.join(plain, "pm.old"), "utf8"), "plain old pm");
});
