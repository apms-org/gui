"use strict";

// The pm command for the shell, the way VS Code installs `code`: a symlink at
// /usr/local/bin/pm that points at the pm bundled inside APM.app, so the
// terminal and the app always run the same engine at the same version.
//
// status() looks at the pm a terminal actually runs and sorts it into one
// state: missing (offer install), current (nothing to do), outdated (offer
// update, which points that pm at the app's copy in place), homebrew (older,
// but Homebrew owns it, so say how to upgrade it there) or newer (update APM).
//
// Everything that touches the system (fs, exec, platform, the link location)
// can be passed in, so tests run against a temp folder.

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const LINK = "/usr/local/bin/pm";
const UNSUPPORTED = "Only the packaged app installs the pm command.";

function fail(code, message, data) {
  const err = new Error(message);
  err.code = code;
  if (data !== undefined) err.data = data;
  throw err;
}

// One argument for /bin/sh, in single quotes.
function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// A double quoted AppleScript string literal.
function appleScriptString(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function defaultExec(file, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: (opts && opts.timeout) || 120000 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// PATH as a terminal sees it, roughly. An app opened from Finder gets a short
// PATH from launchd, so add Homebrew's folder, which shells put first.
function defaultPathDirs(env, platform) {
  const sep = platform === "win32" ? ";" : ":";
  const dirs = String((env || {}).PATH || "").split(sep).filter(Boolean);
  if (platform === "darwin" && !dirs.includes("/opt/homebrew/bin")) dirs.unshift("/opt/homebrew/bin");
  return dirs;
}

const SEMVER = /(\d+)\.(\d+)\.(\d+)/;

// -1, 0 or 1, comparing the first x.y.z in each string.
function compareVersions(a, b) {
  const x = SEMVER.exec(String(a || ""));
  const y = SEMVER.exec(String(b || ""));
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 1; i <= 3; i++) {
    const d = Number(x[i]) - Number(y[i]);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

class CliInstaller {
  constructor(opts) {
    const o = opts || {};
    this.fs = o.fs || fs;
    this.exec = o.exec || defaultExec;
    this.platform = o.platform || process.platform;
    this.packaged = !!o.packaged;
    this.bundled = o.bundled || null;
    this.bundleRoot = o.bundleRoot || null;
    this.version = o.version || null;
    this.link = o.link || LINK;
    this.pathDirs = o.pathDirs || defaultPathDirs(o.env || process.env, this.platform);
    // The login shell answers "which pm" the way a terminal would. null skips
    // it and scans pathDirs instead (tests).
    this.shell = o.shell !== undefined ? o.shell : ((o.env || process.env).SHELL || "/bin/zsh");
    this.readVersion = o.readVersion || null;
  }

  get supported() {
    return this.platform === "darwin" && this.packaged && !!this.bundled;
  }

  realpath(p) {
    try { return this.fs.realpathSync(p); } catch (err) { return null; }
  }

  lstat(p) {
    try { return this.fs.lstatSync(p); } catch (err) { return null; }
  }

  // Where a symlink points, made absolute.
  target(p) {
    try {
      const raw = this.fs.readlinkSync(p);
      return path.resolve(path.dirname(p), raw);
    } catch (err) {
      return null;
    }
  }

  sameAsBundled(p) {
    const a = this.realpath(p);
    const b = this.realpath(this.bundled);
    return !!a && !!b && a === b;
  }

  insideBundle(p) {
    if (!p) return false;
    if (this.sameAsBundled(p)) return true;
    const root = this.bundleRoot ? path.resolve(this.bundleRoot) : null;
    return !!root && (p === root || p.startsWith(root + path.sep));
  }

  // A pm that is not ours, either at the link location or ahead of it on PATH.
  conflict() {
    const st = this.lstat(this.link);
    if (st && !st.isSymbolicLink()) return this.link + " is a file APM did not install. APM will not replace it.";
    if (st && !this.sameAsBundled(this.link)) {
      const to = this.target(this.link);
      return this.link + " links to " + (to || "a missing file") + ", not to this app.";
    }
    const linkDir = path.resolve(path.dirname(this.link));
    for (const dir of this.pathDirs) {
      if (path.resolve(dir) === linkDir) break;
      const candidate = path.join(dir, "pm");
      let file = null;
      try { file = this.fs.statSync(candidate); } catch (err) { file = null; }
      if (!file || !file.isFile()) continue;
      if (this.sameAsBundled(candidate)) continue;
      return candidate + " comes first on your PATH, so a terminal runs that pm instead.";
    }
    return null;
  }

  // The pm a terminal would run. An app opened from Finder gets launchd's short
  // PATH, so ask the login shell, and scan pathDirs if that fails.
  async whichPm() {
    if (this.shell) {
      try {
        const { stdout } = await this.exec(this.shell, ["-ilc", "printf '\\n__APM_PM__%s\\n' \"$(command -v pm)\""], { timeout: 5000 });
        const m = /__APM_PM__(.*)/.exec(String(stdout || ""));
        if (m && path.isAbsolute(m[1].trim())) return m[1].trim();
        if (m && !m[1].trim()) return null;
      } catch (err) {}
    }
    for (const dir of this.pathDirs) {
      const candidate = path.join(dir, "pm");
      try { if (this.fs.statSync(candidate).isFile()) return candidate; } catch (err) {}
    }
    return null;
  }

  // The version a pm reports: `pm --version` from 12.0.0 on; older ones print
  // it in `pm info`. null when neither says.
  async versionOf(p) {
    if (this.readVersion) return this.readVersion(p);
    for (const args of [["--version"], ["info"]]) {
      try {
        const { stdout } = await this.exec(p, args, { timeout: 5000 });
        const m = SEMVER.exec(String(stdout || ""));
        if (m) return m[0];
      } catch (err) {}
    }
    return null;
  }

  async status() {
    const base = { link: this.link, bundled: this.bundled, version: this.version };
    if (!this.supported) return Object.assign(base, { supported: false, reason: UNSUPPORTED, state: "unsupported", installed: false, found: null, conflict: null });
    const st = this.lstat(this.link);
    const installed = !!st && st.isSymbolicLink() && this.sameAsBundled(this.link);
    const at = await this.whichPm();
    let found = null;
    let state = installed ? "current" : "missing";
    if (at) {
      const ours = this.sameAsBundled(at);
      const lst = this.lstat(at);
      found = {
        path: at,
        ours,
        symlink: !!lst && lst.isSymbolicLink(),
        homebrew: /\/Cellar\//.test(this.realpath(at) || at),
        version: ours ? this.version : await this.versionOf(at)
      };
      const cmp = ours ? 0 : found.version ? compareVersions(found.version, this.version) : -1;
      state = cmp === 0 ? "current" : cmp > 0 ? "newer" : found.homebrew ? "homebrew" : "outdated";
    }
    return Object.assign(base, { supported: true, state, installed, found, conflict: this.conflict() });
  }

  // Runs a shell command as root after macOS asks for an administrator.
  async admin(command) {
    const script = "do shell script " + appleScriptString(command) + " with administrator privileges";
    try {
      await this.exec("/usr/bin/osascript", ["-e", script]);
    } catch (err) {
      const text = String((err && (err.stderr || err.message)) || "");
      if (/-128|user cancel/i.test(text)) fail("cancelled", "The administrator prompt was cancelled.");
      if (/not a link/.test(text)) fail("conflict", this.link + " is a file APM did not install, so APM left it alone. Move or delete it, then try again.", { link: this.link });
      fail("permission", "macOS did not allow APM to change " + this.link + ". " + text.trim());
    }
  }

  requireSupported() {
    if (!this.supported) fail("unsupported", UNSUPPORTED);
    if (!this.realpath(this.bundled)) fail("missing", "The pm bundled with APM is missing at " + this.bundled + ".");
  }

  // Points target at the bundled pm, atomically. A regular file there is
  // renamed to <target>.old first, but only when backup is set. Falls back to
  // an administrator prompt when the folder is not writable.
  async placeLink(target, backup) {
    const st = this.lstat(target);
    if (st && !st.isSymbolicLink() && !backup) {
      fail("conflict", target + " is a file APM did not install, so APM left it alone. Move or delete it, then try again.", { link: target });
    }
    const dir = path.dirname(target);
    const tmp = path.join(dir, "." + path.basename(target) + ".apm-" + process.pid + "-" + Date.now());
    try {
      this.fs.mkdirSync(dir, { recursive: true });
      if (st && !st.isSymbolicLink()) this.fs.renameSync(target, target + ".old");
      this.fs.symlinkSync(this.bundled, tmp);
      this.fs.renameSync(tmp, target);
    } catch (err) {
      try { this.fs.unlinkSync(tmp); } catch (e) {}
      if (!err || (err.code !== "EACCES" && err.code !== "EPERM")) throw err;
      const q = shellQuote(target);
      const keep = backup
        ? " && if [ -e " + q + " ] && [ ! -L " + q + " ]; then mv -f " + q + " " + shellQuote(target + ".old") + "; fi"
        : " && if [ -e " + q + " ] && [ ! -L " + q + " ]; then echo 'not a link' >&2; exit 3; fi";
      await this.admin("mkdir -p " + shellQuote(dir) + keep + " && ln -sfn " + shellQuote(this.bundled) + " " + q);
    }
  }

  async install() {
    this.requireSupported();
    if (!this.sameAsBundled(this.link)) await this.placeLink(this.link, false);
    return this.status();
  }

  // Brings an older pm up to the app's version by pointing it at the app's
  // copy where it already is, so PATH order and any vault.dat beside it stay
  // as they were. A plain binary is kept as <path>.old. Homebrew's pm is left
  // to Homebrew.
  async update() {
    this.requireSupported();
    const st = await this.status();
    if (st.state === "homebrew") fail("homebrew", "Homebrew manages " + st.found.path + ". Run brew upgrade pm in a terminal.");
    if (st.state !== "outdated") return st;
    await this.placeLink(st.found.path, true);
    return this.status();
  }

  async uninstall() {
    this.requireSupported();
    const st = this.lstat(this.link);
    if (!st) return this.status();
    if (!st.isSymbolicLink() || !this.insideBundle(this.target(this.link))) {
      fail("conflict", this.link + " does not point at this app, so APM left it alone.", { link: this.link });
    }
    try {
      this.fs.unlinkSync(this.link);
    } catch (err) {
      if (!err || (err.code !== "EACCES" && err.code !== "EPERM")) throw err;
      const link = shellQuote(this.link);
      await this.admin("if [ -L " + link + " ]; then rm -f " + link + "; fi");
    }
    return this.status();
  }
}

// APM.app/Contents/Resources/bin/pm -> APM.app
function bundleRootFor(resourcesPath) {
  return resourcesPath ? path.resolve(resourcesPath, "..", "..") : null;
}

module.exports = { CliInstaller, LINK, UNSUPPORTED, shellQuote, appleScriptString, defaultPathDirs, bundleRootFor, compareVersions };
