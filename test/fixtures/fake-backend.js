"use strict";

const fs = require("node:fs");

const out = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const marker = process.env.FAKE_CRASH_MARKER;
let buffer = "";

process.stderr.write("fake backend ready " + process.argv.slice(2).join(" ") + "\n");

function handle(msg) {
  const { id, method, params } = msg;
  if (method === "app.hello") return out({ id, result: { backend: "fake", args: process.argv.slice(2), desktop: process.env.APM_DESKTOP || "" } });
  if (method === "echo") return out({ id, result: params });
  if (method === "fail") return out({ id, error: { code: params.code || "invalid", message: params.message || "failed", data: params.data } });
  if (method === "emit") {
    out({ event: params.event, data: params.data });
    return out({ id, result: true });
  }
  if (method === "split") {
    const frame = JSON.stringify({ id, result: { text: params.text } }) + "\n";
    const cut = Math.floor(frame.length / 2);
    process.stdout.write(frame.slice(0, cut));
    setTimeout(() => process.stdout.write(frame.slice(cut)), 30);
    return;
  }
  if (method === "big") return out({ id, result: { data: "x".repeat(params.size) } });
  if (method === "slow") return setTimeout(() => out({ id, result: "late" }), params.ms);
  if (method === "noise") {
    process.stdout.write("not json at all\n");
    return out({ id, result: "ok" });
  }
  if (method === "crash") {
    if (marker) fs.appendFileSync(marker, "crash\n");
    process.exit(3);
  }
  out({ id, error: { code: "unsupported", message: "unknown method " + method } });
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl = buffer.indexOf("\n");
  while (nl !== -1) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (line.trim()) handle(JSON.parse(line));
    nl = buffer.indexOf("\n");
  }
});
process.stdin.on("end", () => process.exit(0));
