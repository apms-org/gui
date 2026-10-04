"use strict";

const fs = require("node:fs");

const out = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const marker = process.env.FAKE_CRASH_MARKER;
let buffer = "";
let unlocked = false;
const bridge = { pending: null, lastSeen: null };
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const pick = (n, set) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
const bridgeInfo = () => ({ token: "f".repeat(64), port: 41517, running: true, lastSeen: bridge.lastSeen, pair: bridge.pending });
const snapshot = () => ({ meta: { name: "Fake vault", path: "/tmp/x.dat" }, items: [], bridge: bridgeInfo() });

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
  if (method === "vault.status") return out({ id, result: { exists: true, unlocked, path: "/tmp/x.dat" } });
  if (method === "vault.snapshot") return unlocked ? out({ id, result: { snapshot: snapshot() } }) : out({ id, error: { code: "locked", message: "The vault is locked." } });
  if (method === "vault.lock") {
    unlocked = false;
    return out({ id, result: { ok: true } });
  }
  if (method === "bridge.info") return out({ id, result: bridgeInfo() });
  if (method === "bridge.pairRespond") {
    const p = bridge.pending;
    if (!p || p.id !== params.id) return out({ id, error: { code: "not_found", message: "That pairing request is gone. Choose Connect in the extension again." } });
    const status = params.allow ? "approved" : "denied";
    bridge.pending = null;
    out({ event: "bridge.pairDone", data: { id: p.id, status } });
    return out({ id, result: { ok: true, status } });
  }
  if (method === "test.pairStart") {
    if (bridge.pending) out({ event: "bridge.pairDone", data: { id: bridge.pending.id, status: "cancelled" } });
    bridge.pending = { id: pick(16, "0123456789abcdef"), code: pick(6, ALPHABET), client: params.client || "", expires: Date.now() + 120000 };
    out({ event: "bridge.pair", data: bridge.pending });
    return out({ id, result: bridge.pending });
  }
  if (method === "test.activity") {
    bridge.lastSeen = { ts: Date.now(), client: params.client || "", origin: "chrome-extension://fake" };
    out({ event: "bridge.activity", data: { ts: bridge.lastSeen.ts, client: bridge.lastSeen.client } });
    return out({ id, result: bridge.lastSeen });
  }
  if (method === "test.browserUnlock") {
    unlocked = true;
    out({ event: "vault.unlocked", data: { snapshot: snapshot(), via: params.via || "browser" } });
    return out({ id, result: { ok: true } });
  }
  if (method === "test.browserLock") {
    unlocked = false;
    out({ event: "vault.locked", data: { reason: "Locked from the browser" } });
    return out({ id, result: { ok: true } });
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
