"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { isMcpInstallLink } = require("../electron/links");

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");

test("opens the assistants' install links for APM's server", () => {
  assert.ok(isMcpInstallLink("cursor://anysphere.cursor-deeplink/mcp/install?name=apm&config=" + b64({ command: "pm", args: ["mcp", "serve", "--client", "cursor"] })));
  assert.ok(isMcpInstallLink("vscode:mcp/install?" + encodeURIComponent(JSON.stringify({ name: "apm", command: "pm", args: ["mcp", "serve", "--client", "vscode"] }))));
  assert.ok(isMcpInstallLink("vscode:mcp/install?" + encodeURIComponent(JSON.stringify({ name: "apm", command: "/usr/local/bin/pm", args: [] }))));
  assert.ok(isMcpInstallLink("lmstudio://add_mcp?name=apm&config=" + encodeURIComponent(b64({ command: "pm", args: [] }))));
});

test("refuses other app links and other servers", () => {
  for (const url of [
    "cursor://anysphere.cursor-deeplink/mcp/install?name=evil&config=e30=",
    "cursor://anysphere.cursor-deeplink/settings",
    "vscode:mcp/install?" + encodeURIComponent(JSON.stringify({ name: "apm", command: "/bin/sh" })),
    "vscode:extension/evil.ext",
    "vscode:mcp/install?not-json",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "lmstudio://add_mcp?name=apm&config=x y",
    "",
    null
  ]) assert.equal(isMcpInstallLink(url), false, String(url));
});
