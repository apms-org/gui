import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, watch } from "rolldown";
import { vendorDir, sourceDir, outOfDate } from "./sync-design-system.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "renderer");
const dist = path.join(root, "dist");
const ds = vendorDir;
if (!fs.existsSync(path.join(ds, "bundle.js"))) {
  console.error("The vendored design system is missing from " + ds + ". Restore it from git, or run npm run ds:sync with the design system next to GUI.");
  process.exit(1);
}
const stale = outOfDate(sourceDir());
if (stale.length) console.log("note: " + sourceDir() + " has changes not synced into the app (" + stale.slice(0, 3).join(", ") + (stale.length > 3 ? ", ..." : "") + "). Run npm run ds:sync to take them.");
const watching = process.argv.includes("--watch");
const CSS_ORDER = ["base.css", "auth.css", "shell.css", "pages.css"];

const inputOptions = {
  input: path.join(src, "src", "main.jsx"),
  cwd: root,
  transform: { jsx: { runtime: "classic", pragma: "React.createElement", pragmaFrag: "React.Fragment" } },
  logLevel: "warn"
};

const outputOptions = {
  file: path.join(dist, "app.js"),
  format: "iife",
  minify: !watching,
  comments: false,
  sourcemap: watching ? "inline" : false
};

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to, filter) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const s = path.join(from, name);
    const d = path.join(to, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d, filter);
    else if (!filter || filter(name)) copy(s, d);
  }
}

function writeCss() {
  const parts = CSS_ORDER.map((n) => path.join(src, "css", n)).filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p, "utf8"));
  fs.writeFileSync(path.join(dist, "app.css"), parts.join("\n"));
  const tokens = fs.readFileSync(path.join(ds, "tokens.css"), "utf8").replace(/url\((["']?)[^"')]*?fonts\/([^"')]+)\1\)/g, "url($1fonts/$2$1)");
  fs.writeFileSync(path.join(dist, "tokens.css"), tokens);
}

function copyAssets() {
  copy(path.join(ds, "bundle.css"), path.join(dist, "ds.css"));
  copy(path.join(ds, "bundle.js"), path.join(dist, "ds.js"));
  copyDir(path.join(ds, "fonts"), path.join(dist, "fonts"), (n) => /\.woff2?$/.test(n));
  copy(path.join(src, "vendor", "react.production.min.js"), path.join(dist, "react.js"));
  copy(path.join(src, "vendor", "react-dom.production.min.js"), path.join(dist, "react-dom.js"));
  copyDir(path.join(src, "sounds"), path.join(dist, "sounds"), (n) => /\.(mp3|wav|ogg)$/.test(n));
  copy(path.join(src, "index.html"), path.join(dist, "index.html"));
  copy(path.join(src, "web-shim.js"), path.join(dist, "web-shim.js"));
  writeCss();
}

async function once() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  const started = Date.now();
  await build({ ...inputOptions, output: outputOptions });
  copyAssets();
  const size = fs.statSync(path.join(dist, "app.js")).size;
  console.log("renderer built in " + (Date.now() - started) + " ms, app.js " + Math.round(size / 1024) + " KB");
}

async function watchMode() {
  fs.mkdirSync(dist, { recursive: true });
  copyAssets();
  const watcher = watch({ ...inputOptions, output: outputOptions });
  watcher.on("event", (e) => {
    if (e.code === "BUNDLE_END") console.log("app.js rebuilt in " + e.duration + " ms");
    if (e.code === "ERROR") console.error(e.error && e.error.message ? e.error.message : e.error);
    if (e.code === "BUNDLE_END" && e.result && e.result.close) e.result.close();
  });
  let timer = null;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        copyAssets();
        console.log("assets copied");
      } catch (err) {
        console.error(err.message);
      }
    }, 120);
  };
  for (const dir of ["css", "sounds", "vendor"]) {
    const p = path.join(src, dir);
    if (fs.existsSync(p)) fs.watch(p, { recursive: true }, refresh);
  }
  for (const p of [path.join(ds, "components"), path.join(ds, "fonts")]) fs.watch(p, { recursive: true }, refresh);
  for (const file of [path.join(src, "index.html"), path.join(src, "web-shim.js"), path.join(ds, "tokens.css")]) fs.watch(file, refresh);
  console.log("watching renderer for changes");
}

if (watching) {
  watchMode().catch((err) => { console.error(err); process.exit(1); });
} else {
  once().catch((err) => { console.error(err && err.message ? err.message : err); process.exit(1); });
}
