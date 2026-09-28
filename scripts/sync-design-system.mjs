import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const vendorDir = path.join(root, "vendor", "design-system");

export const FILES = [
  ["tokens.css", "tokens.css"],
  ["themes.js", "themes.js"],
  ["components/bundle.css", "bundle.css"],
  ["components/bundle.js", "bundle.js"],
  ["components/index.d.ts", "index.d.ts"]
];

export function sourceDir(argv = process.argv, env = process.env) {
  const flag = argv.find((a) => a.startsWith("--from="));
  return path.resolve(root, flag ? flag.slice(7) : env.APM_DESIGN_SYSTEM || path.join("..", "design-system"));
}

export function isDesignSystem(dir) {
  return FILES.every(([from]) => fs.existsSync(path.join(dir, from)));
}

function fonts(dir) {
  const d = path.join(dir, "fonts");
  return fs.existsSync(d) ? fs.readdirSync(d).filter((n) => /\.woff2?$/.test(n)).sort() : [];
}

export function outOfDate(dir) {
  if (!isDesignSystem(dir)) return [];
  const stale = FILES.filter(([from, to]) => {
    const dest = path.join(vendorDir, to);
    return !fs.existsSync(dest) || !fs.readFileSync(dest).equals(fs.readFileSync(path.join(dir, from)));
  }).map(([from]) => from);
  for (const f of fonts(dir)) {
    const dest = path.join(vendorDir, "fonts", f);
    if (!fs.existsSync(dest) || !fs.readFileSync(dest).equals(fs.readFileSync(path.join(dir, "fonts", f)))) stale.push("fonts/" + f);
  }
  return stale;
}

function sync(dir) {
  if (!isDesignSystem(dir)) {
    console.error("No design system at " + dir + ".");
    console.error("Point at it with --from=<path> or APM_DESIGN_SYSTEM=<path>.");
    process.exit(1);
  }
  fs.rmSync(vendorDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(vendorDir, "fonts"), { recursive: true });
  for (const [from, to] of FILES) fs.copyFileSync(path.join(dir, from), path.join(vendorDir, to));
  for (const f of fonts(dir)) fs.copyFileSync(path.join(dir, "fonts", f), path.join(vendorDir, "fonts", f));
  let version = "unknown";
  try { version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version; } catch (e) {}
  fs.writeFileSync(path.join(vendorDir, "SOURCE.md"), "# Vendored design system\n\nCopied from the APM design system " + version + " by `npm run ds:sync`. Do not edit these files here. Change them in the design system, then run `npm run ds:sync` again.\n");
  console.log("synced design system " + version + " from " + dir + " into " + path.relative(root, vendorDir));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) sync(sourceDir());
