"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mod = require("node:module");
const { pathToFileURL, fileURLToPath } = require("node:url");
const { Backend } = require("../electron/backend");

const FAKE = path.join(__dirname, "fixtures", "fake-backend.js");
const SRC = path.join(__dirname, "..", "renderer", "src");
const SRC_URL = pathToFileURL(SRC).href + "/";

if (mod.registerHooks) mod.registerHooks({ load: (url, ctx, next) => (url.startsWith(SRC_URL) ? { format: "module", source: fs.readFileSync(fileURLToPath(url)), shortCircuit: true } : next(url, ctx)) });

async function until(fn, label) {
  for (let i = 0; i < 200; i++) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("timed out waiting for " + label);
}

async function boot() {
  const backend = new Backend({ command: process.execPath, args: [FAKE, "desktop", "--vault", "/tmp/x.dat"], env: Object.assign({}, process.env, { APM_DESKTOP: "1" }), restartDelay: 50 });
  const subs = new Map();
  backend.on("event", (event, data) => (subs.get(event) || []).forEach((cb) => cb(data)));
  const played = [];
  globalThis.window = {
    apm: {
      mode: "test",
      call: (method, params) => backend.call(method, params || {}),
      on: (event, cb) => { subs.set(event, (subs.get(event) || []).concat([cb])); return () => {}; },
      app: { info: async () => ({ version: "test" }) }
    }
  };
  globalThis.location = { hash: "" };
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.Audio = class { constructor(src) { this.src = src; } play() { played.push(this.src); return Promise.resolve(); } };
  backend.start();
  const { store, A } = await import(pathToFileURL(path.join(SRC, "lib", "store.js")).href);
  const { ui } = await import(pathToFileURL(path.join(SRC, "lib", "ui.js")).href);
  await A.boot();
  return { backend, S: store.get(), A, ui, played };
}

test("store handles bridge pairing, activity and browser lock state", async (t) => {
  const { backend, S, A, ui, played } = await boot();
  try {
    assert.equal(S.phase, "ready");
    assert.equal(S.session.unlocked, false);
    assert.equal(S.pair, null);

    await t.test("bridge.pair is stored and a newer request replaces it", async () => {
      const first = await backend.call("test.pairStart", { client: "Chrome on macOS" });
      await until(() => S.pair && S.pair.id === first.id, "first pair");
      const second = await backend.call("test.pairStart", { client: "Chrome on macOS" });
      await until(() => S.pair && S.pair.id === second.id, "second pair");
      await new Promise((r) => setTimeout(r, 30));
      assert.deepEqual(S.pair, { id: second.id, code: second.code, client: "Chrome on macOS", expires: second.expires });
    });

    await t.test("pairRespond with allow connects and names the client", async () => {
      const id = S.pair.id;
      const r = await A.pairRespond(id, true);
      assert.equal(r.ok, true);
      assert.equal(r.status, "approved");
      assert.equal(S.pair, null);
      assert.equal(ui.get().toast.title, "Chrome on macOS is connected");
      const again = await A.pairRespond(id, true);
      assert.equal(again.ok, false);
      assert.equal(again.code, "not_found");
      assert.equal(ui.get().toast.title, "Chrome on macOS is connected");
    });

    await t.test("pairRespond with deny clears the request", async () => {
      const p = await backend.call("test.pairStart", { client: "Edge on Windows" });
      await until(() => S.pair && S.pair.id === p.id, "pair");
      const r = await A.pairRespond(p.id, false);
      assert.equal(r.status, "denied");
      assert.equal(S.pair, null);
      assert.equal(ui.get().toast.title, "Connection denied");
    });

    await t.test("pairDone for another id is ignored, a match clears it, expiry closes it", async () => {
      const p = await backend.call("test.pairStart", { client: "Chrome on macOS" });
      await until(() => S.pair && S.pair.id === p.id, "pair");
      await backend.call("emit", { event: "bridge.pairDone", data: { id: "0000000000000000", status: "approved" } });
      await new Promise((r) => setTimeout(r, 30));
      assert.equal(S.pair.id, p.id);
      A.pairExpire(p.id);
      assert.equal(S.pair, null);
      assert.equal(ui.get().toast.title, "Connection request expired");
      await backend.call("emit", { event: "bridge.pair", data: { id: "abcdefabcdefabcd", code: "k7pm2q", client: "Arc", expires: 1 } });
      await until(() => S.pair && S.pair.id === "abcdefabcdefabcd", "seconds pair");
      assert.equal(S.pair.code, "K7PM2Q");
      assert.equal(S.pair.expires, 1000);
      await backend.call("emit", { event: "bridge.pairDone", data: { id: "abcdefabcdefabcd", status: "cancelled" } });
      await until(() => !S.pair, "cancelled pair");
    });

    await t.test("bridge.activity counts as activity and is kept for settings", async () => {
      S.session.lastActive = 1;
      const seen = await backend.call("test.activity", { client: "Chrome 131 on macOS" });
      await until(() => S.seen && S.seen.ts === seen.ts, "activity");
      assert.ok(S.session.lastActive > 1);
      assert.equal(S.seen.client, "Chrome 131 on macOS");
      assert.equal(A.bridgeSeen().client, "Chrome 131 on macOS");
    });

    await t.test("vault.unlocked enters the session like a normal unlock", async () => {
      await backend.call("test.browserUnlock", { via: "browser" });
      await until(() => S.session.unlocked, "unlock");
      assert.equal(S.disk.meta.name, "Fake vault");
      assert.ok(S.session.unlockedAt > 0);
      assert.ok(played.includes("sounds/unlock.mp3"));
      assert.equal(ui.get().toast.title, "Unlocked from the browser");
      assert.equal(ui.get().toast.icon, "lock-open");
      assert.equal(ui.get().toast.tone, "neutral");
      const at = S.session.unlockedAt;
      await backend.call("test.browserUnlock", { via: "browser" });
      await new Promise((r) => setTimeout(r, 30));
      assert.equal(S.session.unlockedAt, at);
    });

    await t.test("vault.locked from the browser keeps its reason for the lock screen", async () => {
      await backend.call("test.browserLock");
      await until(() => !S.session.unlocked, "lock");
      assert.equal(S.disk, null);
      assert.equal(S.session.lockReason, "Locked from the browser");
      assert.ok(played.includes("sounds/lock.mp3"));
      const auth = fs.readFileSync(path.join(SRC, "screens", "auth.jsx"), "utf8");
      assert.match(auth, /session\.lockReason === "Locked from the browser" \? "Locked from the browser"/);
    });
  } finally {
    await backend.stop();
  }
});
