// electron-builder afterPack hook for macOS.
//
// mac.icon points at build/AppIcon.icon, which electron-builder compiles into
// Contents/Resources/Assets.car (macOS 26+). The icon.icns it derives from the
// same source only goes up to 256 px, so the hand-drawn build/icon.icns
// (16 to 1024 px) replaces it for macOS 12 to 15, which still read
// CFBundleIconFile.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin" && context.electronPlatformName !== "mas") return;
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + ".app");
  const resources = path.join(app, "Contents", "Resources");
  const plist = path.join(app, "Contents", "Info.plist");
  const read = (key) => {
    try { return execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :" + key, plist], { encoding: "utf8" }).trim(); } catch (e) { return ""; }
  };

  const iconFile = read("CFBundleIconFile") || "icon.icns";
  const fallback = path.join(context.packager.info.buildResourcesDir, "icon.icns");
  if (fs.existsSync(fallback)) fs.copyFileSync(fallback, path.join(resources, iconFile.endsWith(".icns") ? iconFile : iconFile + ".icns"));

  const iconName = read("CFBundleIconName");
  const car = path.join(resources, "Assets.car");
  if (!iconName || !fs.existsSync(car)) {
    console.warn("  • app icon  macOS 26+ will draw APM as a legacy icon: " + (!iconName ? "CFBundleIconName is missing" : "Assets.car is missing") + ". Check that mac.icon is build/AppIcon.icon and Xcode 26+ is selected (xcode-select -p).");
    return;
  }
  console.log("  • app icon  Assets.car (" + iconName + ") for macOS 26+, " + iconFile + " for older macOS");
};
