"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mod = require("node:module");
const { pathToFileURL, fileURLToPath } = require("node:url");

const SRC = path.join(__dirname, "..", "renderer", "src");
const SRC_URL = pathToFileURL(SRC).href + "/";

if (mod.registerHooks) mod.registerHooks({ load: (url, ctx, next) => (url.startsWith(SRC_URL) ? { format: "module", source: fs.readFileSync(fileURLToPath(url)), shortCircuit: true } : next(url, ctx)) });

const tick = (ms) => new Promise((r) => setTimeout(r, ms || 60));
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const SVG = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";

async function setup() {
  const calls = [];
  const subs = new Map();
  const ctl = { get: null, clear: null };
  globalThis.window = {
    apm: {
      mode: "test",
      call: async (method, params) => {
        calls.push({ method, params });
        if (method === "icons.get") return ctl.get(params);
        if (method === "icons.clear") return ctl.clear(params);
        throw Object.assign(new Error("Unknown method " + method + "."), { code: "unsupported" });
      },
      on: (event, cb) => { subs.set(event, (subs.get(event) || []).concat([cb])); return () => {}; },
      app: { info: async () => ({ version: "test" }) }
    }
  };
  globalThis.location = { hash: "" };
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.Audio = class { play() { return Promise.resolve(); } };
  const { store } = await import(pathToFileURL(path.join(SRC, "lib", "store.js")).href);
  const { ui } = await import(pathToFileURL(path.join(SRC, "lib", "ui.js")).href);
  const icons = await import(pathToFileURL(path.join(SRC, "lib", "icons.js")).href);
  const toasts = [];
  ui.subscribe(() => { const t = ui.get().toast; if (t && !toasts.includes(t)) toasts.push(t); });
  const S = store.get();
  const session = (on) => { S.session.unlocked = on; store.emit(); };
  const settings = (patch) => { S.disk = { settings: Object.assign({ siteIcons: "on" }, patch || {}) }; store.emit(); };
  const emit = (event, data) => (subs.get(event) || []).forEach((cb) => cb(data));
  settings();
  session(true);
  return { calls, ctl, icons, toasts, session, settings, emit, gets: () => calls.filter((c) => c.method === "icons.get") };
}

const login = (website, urls) => ({ type: "password", f: { account: "x", website: website || "", urls: urls || [] } });

test("website icons", async (t) => {
  const env = await setup();
  const { icons } = env;

  await t.test("iconKey follows the contract", () => {
    assert.equal(icons.iconKey(login("https://www.GitHub.com:443/login?x=1")), "github.com");
    assert.equal(icons.iconKey(login("mail.google.com")), "mail.google.com");
    assert.equal(icons.iconKey(login("", ["", "https://vercel.com/dashboard"])), "vercel.com");
    assert.equal(icons.iconKey(login("github.com", ["gitlab.com"])), "github.com");
    assert.equal(icons.iconKey({ type: "totp", f: { account: "x", domain: "Vercel.com" } }), "vercel.com");
    assert.equal(icons.iconKey({ type: "note", f: { domain: "vercel.com" } }), "");
    assert.equal(icons.iconKey({ type: "password", f: { website: "user@example.com:8080" } }), "example.com");
    for (const bad of ["192.168.1.1", "10.0.0.12:8443", "http://[::1]:3000", "localhost:3000", "app.localhost", "printer.local", "db.corp.internal", "intranet", "ftp://example.com", "", "   "]) {
      assert.equal(icons.iconKey(login(bad)), "", bad);
    }
  });

  await t.test("hosts are batched once, cached, and pending hosts refill on icons.updated", async () => {
    env.ctl.get = ({ hosts }) => ({ icons: Object.fromEntries(hosts.map((h) => [h, h === "github.com" ? PNG : h === "evil.example" ? "javascript:alert(1)" : null])), pending: hosts.filter((h) => h === "vercel.com") });
    const items = [login("github.com"), login("https://www.github.com"), login("example.com"), login("vercel.com"), login("evil.example"), login("localhost")];
    assert.deepEqual(items.map(icons.iconFor), [undefined, undefined, undefined, undefined, undefined, undefined]);
    await tick();
    assert.equal(env.gets().length, 1);
    assert.deepEqual(env.gets()[0].params.hosts.slice().sort(), ["evil.example", "example.com", "github.com", "vercel.com"]);
    assert.equal(icons.iconFor(items[0]), PNG);
    assert.equal(icons.iconFor(items[1]), PNG);
    assert.equal(icons.iconFor(items[2]), undefined);
    assert.equal(icons.iconFor(items[4]), undefined);
    assert.equal(icons.iconFor(items[3]), undefined);
    await tick();
    assert.equal(env.gets().length, 1, "cached and pending hosts are not asked again");
    env.ctl.get = ({ hosts }) => ({ icons: Object.fromEntries(hosts.map((h) => [h, SVG])), pending: [] });
    env.emit("icons.updated", { hosts: ["vercel.com", "unrelated.com"] });
    await tick();
    assert.equal(env.gets().length, 2);
    assert.deepEqual(env.gets()[1].params.hosts, ["vercel.com"]);
    assert.equal(icons.iconFor(items[3]), SVG);
  });

  await t.test("the siteIcons switch hides icons and stops requests", async () => {
    env.settings({ siteIcons: "off" });
    const before = env.gets().length;
    assert.equal(icons.iconFor(login("github.com")), undefined);
    assert.equal(icons.iconFor(login("new-site.com")), undefined);
    await tick();
    assert.equal(env.gets().length, before);
    env.settings({ siteIcons: "on" });
    assert.equal(icons.iconFor(login("github.com")), PNG);
  });

  await t.test("clearing the cache empties memory and asks again", async () => {
    env.ctl.clear = () => ({ ok: true });
    const r = await icons.clearIcons();
    assert.equal(r.ok, true);
    const before = env.gets().length;
    assert.equal(icons.iconFor(login("github.com")), undefined);
    await tick();
    assert.equal(env.gets().length, before + 1);
    assert.equal(icons.iconFor(login("github.com")), SVG);
  });

  await t.test("locking drops every icon from memory", async () => {
    env.session(false);
    assert.equal(icons.iconsState().cached, 0);
    env.session(true);
  });

  await t.test("an older backend without icons.get is handled silently", async () => {
    env.ctl.get = () => { throw Object.assign(new Error("Unknown method icons.get."), { code: "unsupported" }); };
    const before = env.gets().length;
    assert.equal(icons.iconFor(login("github.com")), undefined);
    await tick();
    assert.equal(env.gets().length, before + 1);
    assert.equal(icons.iconFor(login("github.com")), undefined);
    assert.equal(icons.iconFor(login("other.com")), undefined);
    await tick();
    assert.equal(env.gets().length, before + 1, "no retries against an older backend");
    assert.equal(icons.iconsState().unsupported, true);
    env.ctl.clear = () => { throw Object.assign(new Error("Unknown method icons.clear."), { code: "unsupported" }); };
    const r = await icons.clearIcons();
    assert.equal(r.ok, false);
    assert.equal(r.unsupported, true);
    assert.equal(env.toasts.length, 0, "no toast from the store");
  });
});
