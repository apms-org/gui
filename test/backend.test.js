"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Backend } = require("../electron/backend");

const FAKE = path.join(__dirname, "fixtures", "fake-backend.js");

function make(extra) {
  return new Backend(Object.assign({ command: process.execPath, args: [FAKE, "desktop", "--vault", "/tmp/x.dat"], env: Object.assign({}, process.env, { APM_DESKTOP: "1" }), restartDelay: 50 }, extra || {}));
}

function nextEvent(b, name) {
  return new Promise((resolve) => {
    const on = (event, data) => {
      if (event !== name) return;
      b.off("event", on);
      resolve(data);
    };
    b.on("event", on);
  });
}

test("round trips requests with ids and passes args and env", async () => {
  const b = make();
  b.start();
  try {
    const hello = await b.call("app.hello");
    assert.equal(hello.backend, "fake");
    assert.deepEqual(hello.args, ["desktop", "--vault", "/tmp/x.dat"]);
    assert.equal(hello.desktop, "1");
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => b.call("echo", { n })));
    assert.deepEqual(results.map((r) => r.n), [1, 2, 3, 4, 5]);
  } finally {
    await b.stop();
  }
});

test("maps error frames to errors with code, message and data", async () => {
  const b = make();
  b.start();
  try {
    await assert.rejects(b.call("fail", { code: "wrong_password", message: "Nope", data: { left: 2 } }), (err) => {
      assert.equal(err.code, "wrong_password");
      assert.equal(err.message, "Nope");
      assert.deepEqual(err.data, { left: 2 });
      return true;
    });
  } finally {
    await b.stop();
  }
});

test("forwards events and ignores non protocol noise", async () => {
  const b = make();
  const logs = [];
  b.on("log", (l) => logs.push(l));
  b.start();
  try {
    const got = nextEvent(b, "vault.changed");
    await b.call("emit", { event: "vault.changed", data: { snapshot: { v: 4 } } });
    assert.deepEqual(await got, { snapshot: { v: 4 } });
    assert.equal(await b.call("noise"), "ok");
    assert.ok(logs.some((l) => l.includes("not json at all")));
  } finally {
    await b.stop();
  }
});

test("forwards bridge pairing events and answers bridge.pairRespond", async () => {
  const b = make();
  b.start();
  try {
    const asked = nextEvent(b, "bridge.pair");
    const started = await b.call("test.pairStart", { client: "Chrome on macOS" });
    const req = await asked;
    assert.deepEqual(req, started);
    assert.match(req.id, /^[0-9a-f]{16}$/);
    assert.match(req.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    assert.equal(req.client, "Chrome on macOS");
    assert.ok(req.expires > Date.now());
    assert.deepEqual((await b.call("bridge.info")).pair, req);
    const done = nextEvent(b, "bridge.pairDone");
    assert.deepEqual(await b.call("bridge.pairRespond", { id: req.id, allow: true }), { ok: true, status: "approved" });
    assert.deepEqual(await done, { id: req.id, status: "approved" });
    assert.equal((await b.call("bridge.info")).pair, null);
    await assert.rejects(b.call("bridge.pairRespond", { id: req.id, allow: false }), (err) => err.code === "not_found");
    const seen = nextEvent(b, "bridge.activity");
    await b.call("test.activity", { client: "Chrome 131 on macOS" });
    const act = await seen;
    assert.equal(act.client, "Chrome 131 on macOS");
    assert.ok(act.ts > 0);
    assert.equal((await b.call("bridge.info")).lastSeen.ts, act.ts);
  } finally {
    await b.stop();
  }
});

test("forwards vault.unlocked and vault.locked from the browser", async () => {
  const b = make();
  b.start();
  try {
    const unlocked = nextEvent(b, "vault.unlocked");
    await b.call("test.browserUnlock", { via: "browser-touchid" });
    const u = await unlocked;
    assert.equal(u.via, "browser-touchid");
    assert.equal(u.snapshot.meta.name, "Fake vault");
    const locked = nextEvent(b, "vault.locked");
    await b.call("test.browserLock");
    assert.deepEqual(await locked, { reason: "Locked from the browser" });
  } finally {
    await b.stop();
  }
});

test("reassembles frames split across chunks and handles large payloads", async () => {
  const b = make();
  b.start();
  try {
    const r = await b.call("split", { text: "héllo wörld" });
    assert.equal(r.text, "héllo wörld");
    const big = await b.call("big", { size: 3 * 1024 * 1024 });
    assert.equal(big.data.length, 3 * 1024 * 1024);
  } finally {
    await b.stop();
  }
});

test("times out a call when asked to", async () => {
  const b = make();
  b.start();
  try {
    await assert.rejects(b.call("slow", { ms: 500 }, { timeout: 50 }), /did not answer/);
  } finally {
    await b.stop();
  }
});

test("restarts once after a crash, then reports backend.exit", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apm-backend-test-"));
  const marker = path.join(dir, "marker");
  const b = make({ env: Object.assign({}, process.env, { FAKE_CRASH_MARKER: marker }) });
  const events = [];
  b.on("event", (e, d) => events.push([e, d]));
  const restarted = new Promise((r) => b.once("restart", r));
  b.start();
  try {
    await assert.rejects(b.call("crash"), (err) => err.code === "internal");
    await restarted;
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(events.some(([e]) => e === "vault.locked"));
    assert.equal((await b.call("app.hello")).backend, "fake");
    const exited = nextEvent(b, "backend.exit");
    await assert.rejects(b.call("crash"));
    const info = await exited;
    assert.equal(info.code, 3);
    assert.equal(info.reason, "crash");
    assert.ok(Array.isArray(info.stderr));
    assert.equal(fs.readFileSync(marker, "utf8").trim().split("\n").length, 2);
    await assert.rejects(b.call("echo", {}), /not running/);
  } finally {
    await b.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("restart with new args spawns a fresh process", async () => {
  const b = make();
  b.start();
  try {
    await b.call("app.hello");
    await b.restart({ args: [FAKE, "desktop", "--vault", "/tmp/y.dat"] });
    const hello = await b.call("app.hello");
    assert.deepEqual(hello.args, ["desktop", "--vault", "/tmp/y.dat"]);
  } finally {
    await b.stop();
  }
});

test("reports a missing binary as backend.exit", async () => {
  const b = new Backend({ command: null });
  const exited = nextEvent(b, "backend.exit");
  b.start();
  const info = await exited;
  assert.equal(info.reason, "missing");
  const b2 = new Backend({ command: path.join(os.tmpdir(), "definitely-not-a-real-pm-binary") });
  const exited2 = nextEvent(b2, "backend.exit");
  b2.start();
  const info2 = await exited2;
  assert.equal(info2.reason, "spawn");
});
