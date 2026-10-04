import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_NAME = "APM.app";
const OUT = { arm64: "arm64", x64: "amd64" };

function arg(name) {
  const i = process.argv.indexOf("--" + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith("--" + name + "="));
  return eq ? eq.slice(name.length + 3) : undefined;
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false", ...(env || {}) } });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}

const requested = arg("arch") || (process.argv.includes("--all") ? "all" : process.arch);
const arches = requested === "all" ? ["arm64", "x64"] : [requested === "amd64" ? "x64" : requested];
for (const a of arches) {
  if (!OUT[a]) {
    console.error("Unsupported arch " + a + ". Use arm64, x64 or all.");
    process.exit(1);
  }
}

const builderCli = path.join(root, "node_modules", "electron-builder", "cli.js");
const platformFlag = process.platform === "darwin" ? "--mac" : process.platform === "win32" ? "--win" : "--linux";

run(process.execPath, [path.join("scripts", "build-renderer.mjs")]);
// Universal binary, so one build serves both arches.
run(process.execPath, [path.join("scripts", "build-native.mjs")]);
fs.rmSync(path.join(root, "release"), { recursive: true, force: true });

for (const arch of arches) {
  const outDir = OUT[arch];
  console.log("\nbuilding " + arch + " into release/" + outDir);
  run(process.execPath, [path.join("scripts", "build-backend.mjs"), "--arch", arch]);
  run(process.execPath, [builderCli, platformFlag,"dir", "--" + arch, "-c.directories.output=release/" + outDir]);
  if (process.platform === "darwin") {
    const nested = path.join(root, "release", outDir, arch === "arm64" ? "mac-arm64" : "mac", APP_NAME);
    const dest = path.join(root, "release", outDir, APP_NAME);
    if (!fs.existsSync(nested)) {
      console.error("Expected " + nested + " but it was not produced.");
      process.exit(1);
    }
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(nested, dest);
    fs.rmSync(path.dirname(nested), { recursive: true, force: true });
    console.log("ready: " + path.relative(root, dest));
  }
}

if (arches.some((a) => a !== process.arch)) {
  console.log("\nrebuilding bin/pm for this machine");
  run(process.execPath, [path.join("scripts", "build-backend.mjs")]);
}
