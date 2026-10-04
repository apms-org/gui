// Renders build/AppIcon.icon into build/icon-dev.png for `npm run dev`.
//
// A packaged APM.app carries the icon as Assets.car, and macOS 26+ draws the
// glass, the shadow and the Default, Dark, Clear and Tinted styles itself. In
// development Electron runs from its own Electron.app, so main.js sets the
// Dock icon to this PNG instead: the Default style from Icon Composer's
// renderer, laid out on the macOS 1024 grid with the shadow the Dock would add.
// It cannot follow the Dark, Clear or Tinted styles. Needs Xcode 26 or later.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "build", "AppIcon.icon");
const out = path.join(root, "build", "icon-dev.png");

if (process.platform !== "darwin") {
  console.error("render-icon runs on macOS only.");
  process.exit(1);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error || r.status !== 0) {
    console.error((r.stderr || r.stdout || String(r.error)).trim());
    process.exit(1);
  }
  return r.stdout;
}

const xcode = run("xcode-select", ["-p"]).trim();
const ictool = path.join(path.dirname(xcode), "Applications", "Icon Composer.app", "Contents", "Executables", "ictool");
if (!fs.existsSync(ictool)) {
  console.error("Icon Composer's ictool was not found under " + xcode + ". Install Xcode 26 or later and select it with xcode-select.");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apm-icon-"));
try {
  const body = path.join(tmp, "body.png");
  run(ictool, [source, "--export-image", "--output-file", body, "--platform", "macOS", "--rendition", "Default", "--width", "824", "--height", "824", "--scale", "2"]);

  // 824 pt body centered on a 1024 pt canvas, with the Dock's soft drop shadow.
  const swift = path.join(tmp, "compose.swift");
  fs.writeFileSync(swift, `import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { exit(1) }
let side = 2048, scale = 2.0
let ctx = CGContext(data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.interpolationQuality = .high
ctx.setShadow(offset: CGSize(width: 0, height: -10 * scale), blur: 20 * scale, color: CGColor(gray: 0, alpha: 0.3))
ctx.draw(img, in: CGRect(x: 100 * scale, y: 100 * scale, width: 824 * scale, height: 824 * scale))
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, [kCGImagePropertyDPIWidth: 144, kCGImagePropertyDPIHeight: 144] as CFDictionary)
exit(CGImageDestinationFinalize(dest) ? 0 : 1)
`);
  run("xcrun", ["swift", "-module-cache-path", path.join(tmp, "modules"), swift, body, out]);
  console.log("wrote " + path.relative(root, out));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
