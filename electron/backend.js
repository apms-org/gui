"use strict";

const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const { StringDecoder } = require("node:string_decoder");

const STDERR_TAIL = 40;

class BackendError extends Error {
  constructor(code, message, data) {
    super(message || "Something went wrong.");
    this.code = code || "internal";
    if (data !== undefined) this.data = data;
  }
}

function toEnvelopeError(err) {
  if (!err) return { code: "internal", message: "Something went wrong." };
  const out = { code: err.code || "internal", message: err.message || String(err) };
  if (err.data !== undefined) out.data = err.data;
  return out;
}

class Backend extends EventEmitter {
  constructor(options) {
    super();
    const o = options || {};
    this.command = o.command;
    this.args = o.args || [];
    this.env = o.env || process.env;
    this.cwd = o.cwd;
    this.maxRestarts = o.restarts === undefined ? 1 : o.restarts;
    this.restartDelay = o.restartDelay === undefined ? 400 : o.restartDelay;
    this.spawnImpl = o.spawn || spawn;
    this.child = null;
    this.nextId = 1;
    this.pending = new Map();
    this.restartsLeft = this.maxRestarts;
    this.stopping = false;
    this.stderrTail = [];
    this.generation = 0;
    this.started = false;
  }

  configure(patch) {
    if (patch.command !== undefined) this.command = patch.command;
    if (patch.args !== undefined) this.args = patch.args;
    if (patch.env !== undefined) this.env = patch.env;
    if (patch.cwd !== undefined) this.cwd = patch.cwd;
  }

  get running() {
    return !!(this.child && this.child.exitCode === null && this.child.signalCode === null && !this.child.killed);
  }

  start() {
    this.stopping = false;
    this.started = true;
    this.restartsLeft = this.maxRestarts;
    this.spawnChild();
  }

  spawnChild() {
    if (!this.command) {
      this.emitExit({ code: null, signal: null, reason: "missing", message: "The pm binary was not found. Build it with npm run build:backend or set APM_PM_PATH." });
      return;
    }
    const generation = ++this.generation;
    let child;
    try {
      child = this.spawnImpl(this.command, this.args, { env: this.env, cwd: this.cwd, stdio: ["pipe", "pipe", "pipe"] });
    } catch (err) {
      this.emitExit({ code: null, signal: null, reason: "spawn", message: err.message });
      return;
    }
    this.child = child;
    this.stderrTail = [];
    const out = new StringDecoder("utf8");
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      if (generation !== this.generation) return;
      buffer += out.write(chunk);
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (line.trim()) this.handleLine(line);
        nl = buffer.indexOf("\n");
      }
    });
    const errDecoder = new StringDecoder("utf8");
    let errBuffer = "";
    child.stderr.on("data", (chunk) => {
      errBuffer += errDecoder.write(chunk);
      let nl = errBuffer.indexOf("\n");
      while (nl !== -1) {
        const line = errBuffer.slice(0, nl);
        errBuffer = errBuffer.slice(nl + 1);
        this.stderrTail.push(line);
        if (this.stderrTail.length > STDERR_TAIL) this.stderrTail.shift();
        this.emit("log", line);
        nl = errBuffer.indexOf("\n");
      }
    });
    child.stdin.on("error", () => {});
    child.on("error", (err) => {
      if (generation !== this.generation) return;
      this.failPending(new BackendError("internal", "The APM backend could not start: " + err.message));
      this.child = null;
      this.emitExit({ code: null, signal: null, reason: "spawn", message: err.message });
    });
    child.on("exit", (code, signal) => {
      if (generation !== this.generation) return;
      this.child = null;
      this.failPending(new BackendError("internal", "The APM backend stopped unexpectedly."));
      if (this.stopping) {
        this.emit("stopped", { code, signal });
        return;
      }
      if (this.restartsLeft > 0) {
        this.restartsLeft -= 1;
        this.emit("restart", { code, signal, stderr: this.stderrTail.slice() });
        setTimeout(() => {
          if (this.stopping) return;
          this.spawnChild();
          if (this.child) this.emit("event", "vault.locked", { reason: "The APM backend restarted." });
        }, this.restartDelay);
        return;
      }
      this.emitExit({ code, signal, reason: "crash", message: "The APM backend stopped." });
    });
    this.emit("spawn", { pid: child.pid });
  }

  emitExit(info) {
    const data = Object.assign({ stderr: this.stderrTail.slice() }, info);
    this.emit("event", "backend.exit", data);
  }

  handleLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      this.emit("log", "unparsed: " + line.slice(0, 500));
      return;
    }
    if (msg && typeof msg.event === "string" && msg.id === undefined) {
      this.emit("event", msg.event, msg.data === undefined ? null : msg.data);
      return;
    }
    if (msg && msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (p.timer) clearTimeout(p.timer);
      if (msg.error) {
        const e = msg.error;
        p.reject(new BackendError(e.code, e.message, e.data));
      } else {
        p.resolve(msg.result === undefined ? null : msg.result);
      }
    }
  }

  call(method, params, options) {
    const o = options || {};
    return new Promise((resolve, reject) => {
      if (typeof method !== "string" || !method) {
        reject(new BackendError("invalid", "A method name is required."));
        return;
      }
      if (!this.running) {
        reject(new BackendError("internal", "The APM backend is not running."));
        return;
      }
      const id = this.nextId++;
      const frame = JSON.stringify({ id, method, params: params === undefined ? {} : params }) + "\n";
      const entry = { resolve, reject, timer: null, method };
      if (o.timeout && o.timeout > 0) {
        entry.timer = setTimeout(() => {
          if (!this.pending.has(id)) return;
          this.pending.delete(id);
          reject(new BackendError("internal", "The APM backend did not answer " + method + " in time."));
        }, o.timeout);
      }
      this.pending.set(id, entry);
      try {
        this.child.stdin.write(frame);
      } catch (err) {
        this.pending.delete(id);
        if (entry.timer) clearTimeout(entry.timer);
        reject(new BackendError("internal", "Could not reach the APM backend: " + err.message));
      }
    });
  }

  failPending(err) {
    const list = Array.from(this.pending.values());
    this.pending.clear();
    for (const p of list) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    }
  }

  stop(graceMs) {
    const grace = graceMs === undefined ? 1500 : graceMs;
    this.stopping = true;
    const child = this.child;
    if (!child) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      child.once("exit", finish);
      try { child.stdin.end(); } catch (err) {}
      const term = setTimeout(() => { try { child.kill("SIGTERM"); } catch (err) {} }, grace);
      const kill = setTimeout(() => { try { child.kill("SIGKILL"); } catch (err) {} finish(); }, grace + 1500);
      child.once("exit", () => { clearTimeout(term); clearTimeout(kill); });
    });
  }

  async restart(patch) {
    if (patch) this.configure(patch);
    await this.stop();
    this.start();
  }
}

module.exports = { Backend, BackendError, toEnvelopeError };
