// Builds native/touchid.mm into native/build/apm_touchid.node, a universal
// (arm64 + x86_64) Node-API module that puts the Touch ID check inline on the
// lock screen. macOS only; elsewhere this does nothing.
//
// --optional  warn instead of failing (npm run dev). The app then falls back
//             to the system Touch ID dialog, which still names APM.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "native", "touchid.mm");
const OUT = path.join(root, "native", "build", "apm_touchid.node");
const optional = process.argv.includes("--optional");

function fail(lines) {
  for (const l of [].concat(lines)) console.error(l);
  if (optional) {
    console.error("Continuing without inline Touch ID. The lock screen will use the system dialog.");
    process.exit(0);
  }
  process.exit(1);
}

if (process.platform !== "darwin") process.exit(0);

if (fs.existsSync(OUT) && fs.statSync(OUT).mtimeMs >= fs.statSync(SOURCE).mtimeMs && !process.argv.includes("--force")) {
  console.log("native Touch ID module is up to date");
  process.exit(0);
}

function nodeHeaders() {
  const candidates = [
    process.env.APM_NODE_INCLUDE,
    path.join(path.dirname(process.execPath), "..", "include", "node"),
    "/opt/homebrew/include/node",
    "/usr/local/include/node"
  ].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(path.join(dir, "node_api.h")));
}

const include = nodeHeaders();
if (!include) fail(["node_api.h was not found next to " + process.execPath + ".", "Install Node from nodejs.org or Homebrew, or point APM_NODE_INCLUDE at a folder that has node_api.h."]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const started = Date.now();
const r = spawnSync("xcrun", [
  "clang++", "-std=c++17", "-fobjc-arc", "-O2", "-Wall",
  "-bundle", "-undefined", "dynamic_lookup",
  "-mmacosx-version-min=12.0", "-arch", "arm64", "-arch", "x86_64",
  "-I", include,
  "-framework", "AppKit", "-framework", "LocalAuthentication", "-framework", "LocalAuthenticationEmbeddedUI",
  SOURCE, "-o", OUT
], { stdio: "inherit" });
if (r.error) fail("Could not run xcrun clang++: " + r.error.message + ". Install the Xcode command line tools with xcode-select --install.");
if (r.status !== 0) fail("The native Touch ID module did not compile.");
console.log("native Touch ID module built at " + path.relative(root, OUT) + " in " + (Date.now() - started) + " ms");
