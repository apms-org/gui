import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const VERSION = pkg.version;
const CLI_REPO = process.env.APM_CLI_REPO || "https://github.com/apms-org/apm.git";
// A release builds pm from the tag with the app's version, so the app and pm
// ship from the same tag with the same number. Dev builds use the working
// copy next to this folder, or APM_CLI_REF (default master) when there is none.
const RELEASE = process.argv.includes("--release");
const TAG = "v" + VERSION;
const CLI_REF = RELEASE ? TAG : process.env.APM_CLI_REF || "master";

function arg(name) {
  const i = process.argv.indexOf("--" + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith("--" + name + "="));
  return eq ? eq.slice(name.length + 3) : undefined;
}

function run(cmd, args, opts) {
  return spawnSync(cmd, args, { stdio: "inherit", ...opts });
}

function capture(cmd, args, opts) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { ok: !r.error && r.status === 0, out: String(r.stdout || "").trim(), err: String(r.stderr || "").trim() };
}

// github.com/apms-org/apm.git -> apms-org/apm
function repoName(url) {
  const m = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url);
  return m ? m[1] : url;
}

function has(cmd) {
  const r = spawnSync(cmd, ["version"], { stdio: "ignore" });
  return !r.error && r.status === 0;
}

function onPath(name) {
  const exts = process.platform === "win32" ? [".exe", ""] : [""];
  for (const dir of String(process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const p = path.join(dir, name + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function fail(lines) {
  for (const l of [].concat(lines)) console.error(l);
  process.exit(1);
}

function requireTag() {
  const r = capture("git", ["ls-remote", "--tags", CLI_REPO, "refs/tags/" + TAG]);
  if (!r.ok) fail(["Could not reach " + CLI_REPO + " to look for " + TAG + ". " + r.err, "Check your connection, or pass --src for a local build."]);
  if (!r.out) fail("Tag " + TAG + " is not on " + repoName(CLI_REPO) + " yet. Tag and push the CLI first, or pass --src for a local build.");
}

function fetchCli() {
  const dir = path.join(root, ".cache", "cli");
  if (!has("git")) fail(["The CLI source is not next to GUI and git is not installed to fetch it.", "Install git, or point at a local copy with APM_SRC=<path> or --src <path>."]);
  if (RELEASE) {
    requireTag();
    if (fs.existsSync(path.join(dir, ".git"))) {
      console.log("fetching " + TAG + " from " + CLI_REPO + " into " + path.relative(root, dir));
      const f = run("git", ["-C", dir, "fetch", "--depth", "1", "--no-tags", CLI_REPO, "refs/tags/" + TAG]);
      if (f.status !== 0) fail("Could not fetch " + TAG + " from " + CLI_REPO + ". Check your connection.");
      if (run("git", ["-C", dir, "checkout", "--force", "--quiet", "FETCH_HEAD"]).status !== 0) fail("Could not check out " + TAG + " in " + dir + ".");
      run("git", ["-C", dir, "clean", "-fdxq"]);
    } else {
      console.log("fetching " + TAG + " from " + CLI_REPO);
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      const c = run("git", ["clone", "--quiet", "--depth", "1", "--branch", TAG, CLI_REPO, dir]);
      if (c.status !== 0) fail("Could not clone " + CLI_REPO + " at " + TAG + ". Check your connection.");
    }
    return dir;
  }
  if (fs.existsSync(path.join(dir, ".git"))) {
    console.log("updating the CLI source (" + CLI_REF + ") in " + path.relative(root, dir));
    const f = run("git", ["-C", dir, "fetch", "--depth", "1", "origin", CLI_REF]);
    if (f.status !== 0) fail("Could not fetch " + CLI_REF + " from " + CLI_REPO + ". Check your connection, or set APM_CLI_REF.");
    run("git", ["-C", dir, "checkout", "--force", "--quiet", "FETCH_HEAD"]);
  } else {
    console.log("fetching the CLI source (" + CLI_REF + ") from " + CLI_REPO);
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const c = run("git", ["clone", "--depth", "1", "--branch", CLI_REF, CLI_REPO, dir]);
    if (c.status !== 0) fail("Could not clone " + CLI_REPO + " at " + CLI_REF + ". Check your connection, or set APM_CLI_REPO and APM_CLI_REF.");
  }
  return dir;
}

// The sibling checkout counts for a release only when it is exactly the tag.
function siblingAtTag(dir) {
  const tag = capture("git", ["-C", dir, "describe", "--exact-match", "--tags", "HEAD"]);
  if (!tag.ok || tag.out !== TAG) return "it is not at " + TAG + (tag.ok ? " (HEAD is " + tag.out + ")" : "");
  const status = capture("git", ["-C", dir, "status", "--porcelain"]);
  if (!status.ok) return "git could not read it";
  if (status.out) return "it has uncommitted changes";
  return null;
}

function resolveSource() {
  const explicit = arg("src") || process.env.APM_SRC;
  if (explicit) {
    const dir = path.resolve(root, explicit);
    if (!fs.existsSync(path.join(dir, "go.mod"))) fail("No go.mod in " + dir + ". APM_SRC and --src must point at the CLI source.");
    if (RELEASE) console.warn("warning: building pm from " + dir + " instead of " + repoName(CLI_REPO) + " at " + TAG + ". This build is not reproducible.");
    return dir;
  }
  const sibling = path.resolve(root, "..", "CLI");
  if (fs.existsSync(path.join(sibling, "go.mod"))) {
    if (!RELEASE) return sibling;
    const why = has("git") ? siblingAtTag(sibling) : "git is not installed";
    if (!why) return sibling;
    console.log("../CLI is not used for the release because " + why + ".");
  }
  return fetchCli();
}

// `pm --version` prints something like "pm version 12.0.0".
function builtVersion(bin) {
  const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  const m = /\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/.exec((r.stdout || "") + " " + (r.stderr || ""));
  return m ? m[1] : null;
}

const ARCH = { x64: "amd64", amd64: "amd64", arm64: "arm64" };
const goarch = ARCH[arg("arch") || process.env.GOARCH || ""] || undefined;
const goos = arg("os") || process.env.GOOS || undefined;
const exe = (goos || process.platform) === "win32" || goos === "windows" ? "pm.exe" : "pm";
const out = path.resolve(root, arg("out") || path.join("bin", exe));

if (!has("go")) {
  if (RELEASE) fail("Go is not installed. A release builds pm from " + TAG + ", so install Go 1.25 or newer from https://go.dev/dl.");
  const existing = process.env.APM_PM_PATH || (fs.existsSync(out) ? out : null) || onPath("pm");
  if (existing && !goarch && !goos) {
    console.log("Go is not installed, so the backend was not rebuilt. The app will use " + existing + ".");
    process.exit(0);
  }
  fail("Go is not installed. Install Go 1.25 or newer from https://go.dev/dl, or set APM_PM_PATH to a pm binary that has the desktop command.");
}

const source = resolveSource();
fs.mkdirSync(path.dirname(out), { recursive: true });
const env = { ...process.env, CGO_ENABLED: process.env.CGO_ENABLED || "0" };
if (goarch) env.GOARCH = goarch;
if (goos) env.GOOS = goos;

const started = Date.now();
const r = run("go", ["build", "-trimpath", "-ldflags", "-s -w -X main.Version=" + VERSION, "-o", out, "."], { cwd: source, env });
if (r.error) fail("Could not run go: " + r.error.message);
if (r.status !== 0) process.exit(r.status || 1);

const cross = (goarch && goarch !== ARCH[process.arch]) || (goos && goos !== process.platform && !(goos === "windows" && process.platform === "win32"));
if (!cross) {
  const probe = spawnSync(out, ["desktop", "--help"], { encoding: "utf8" });
  if (probe.status !== 0 || /unknown command/i.test((probe.stdout || "") + (probe.stderr || ""))) {
    fs.rmSync(out, { force: true });
    fail(["Built " + path.relative(root, out) + " from " + source + ", but it has no desktop command.", "That CLI source predates the desktop app. Use a newer checkout, or set APM_CLI_REF to a branch or tag that has it."]);
  }
  const got = builtVersion(out);
  if (got !== VERSION) {
    const msg = "pm --version reports " + (got || "no version") + " but the app is " + VERSION + ".";
    if (RELEASE) {
      fs.rmSync(out, { force: true });
      fail([msg, "The app and pm ship with the same version. Build pm from " + TAG + ", or bump package.json."]);
    }
    console.warn("warning: " + msg);
  }
}
console.log("backend " + VERSION + (RELEASE ? " (release, " + TAG + ")" : "") + " built at " + path.relative(root, out) + " from " + (path.relative(root, source).startsWith("..") ? source : path.relative(root, source)) + (goarch ? " for " + goarch : "") + " in " + (Date.now() - started) + " ms");
