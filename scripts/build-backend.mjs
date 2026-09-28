import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI_REPO = process.env.APM_CLI_REPO || "https://github.com/aaravmaloo/apm.git";
const CLI_REF = process.env.APM_CLI_REF || "master";

function arg(name) {
  const i = process.argv.indexOf("--" + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith("--" + name + "="));
  return eq ? eq.slice(name.length + 3) : undefined;
}

function run(cmd, args, opts) {
  return spawnSync(cmd, args, { stdio: "inherit", ...opts });
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

function fetchCli() {
  const dir = path.join(root, ".cache", "cli");
  if (!has("git")) fail(["The CLI source is not next to GUI and git is not installed to fetch it.", "Install git, or point at a local copy with APM_SRC=<path> or --src <path>."]);
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

function resolveSource() {
  const explicit = arg("src") || process.env.APM_SRC;
  if (explicit) {
    const dir = path.resolve(root, explicit);
    if (!fs.existsSync(path.join(dir, "go.mod"))) fail("No go.mod in " + dir + ". APM_SRC and --src must point at the CLI source.");
    return dir;
  }
  const sibling = path.resolve(root, "..", "CLI");
  if (fs.existsSync(path.join(sibling, "go.mod"))) return sibling;
  return fetchCli();
}

const ARCH = { x64: "amd64", amd64: "amd64", arm64: "arm64" };
const goarch = ARCH[arg("arch") || process.env.GOARCH || ""] || undefined;
const goos = arg("os") || process.env.GOOS || undefined;
const exe = (goos || process.platform) === "win32" || goos === "windows" ? "pm.exe" : "pm";
const out = path.resolve(root, arg("out") || path.join("bin", exe));

if (!has("go")) {
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
const r = run("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", out, "."], { cwd: source, env });
if (r.error) fail("Could not run go: " + r.error.message);
if (r.status !== 0) process.exit(r.status || 1);

const cross = (goarch && goarch !== ARCH[process.arch]) || (goos && goos !== process.platform && !(goos === "windows" && process.platform === "win32"));
if (!cross) {
  const probe = spawnSync(out, ["desktop", "--help"], { encoding: "utf8" });
  if (probe.status !== 0 || /unknown command/i.test((probe.stdout || "") + (probe.stderr || ""))) {
    fs.rmSync(out, { force: true });
    fail(["Built " + path.relative(root, out) + " from " + source + ", but it has no desktop command.", "That CLI source predates the desktop app. Use a newer checkout, or set APM_CLI_REF to a branch or tag that has it."]);
  }
}
console.log("backend built at " + path.relative(root, out) + " from " + (path.relative(root, source).startsWith("..") ? source : path.relative(root, source)) + (goarch ? " for " + goarch : "") + " in " + (Date.now() - started) + " ms");
