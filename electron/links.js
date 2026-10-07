"use strict";

// One-click MCP install links for the assistants on Settings → AI access.
// Only these exact prefixes open, and only for APM's own server entry, so the
// renderer can't hand an arbitrary app link to the OS.
const MCP_INSTALL_PREFIXES = [
  "cursor://anysphere.cursor-deeplink/mcp/install?",
  "vscode:mcp/install?",
  "vscode-insiders:mcp/install?",
  "lmstudio://add_mcp?"
];

function isMcpInstallLink(raw) {
  const s = String(raw || "");
  if (s.length > 4096 || /[\s<>"]/.test(s)) return false;
  const prefix = MCP_INSTALL_PREFIXES.find((p) => s.startsWith(p));
  if (!prefix) return false;
  const query = s.slice(prefix.length);
  // Cursor and LM Studio name the server in ?name=; VS Code puts it in the JSON.
  if (prefix.startsWith("vscode")) {
    let cfg;
    try { cfg = JSON.parse(decodeURIComponent(query)); } catch (err) { return false; }
    return !!cfg && cfg.name === "apm" && /(^|\/)pm$/.test(String(cfg.command || ""));
  }
  return new URLSearchParams(query).get("name") === "apm";
}

module.exports = { isMcpInstallLink, MCP_INSTALL_PREFIXES };
