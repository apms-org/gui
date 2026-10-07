// The MCP approval panel (electron/approvals.js). It shows one request at a
// time and talks to the main process only through window.apmApproval.
import { TYPES, getType } from "../lib/types.js";

const A = window.APM;
const api = window.apmApproval;
const { useState, useEffect, useRef, useCallback } = React;

const HOLD_MS = 450;
const LEAVE_MS = 300; // the sheet's 280ms exit, plus a frame
const ENTER_FALLBACK_MS = 480;
const ERR_RESET_MS = 1800;
const MAX_FAILS = 3;
// TouchIdGlyph at 64px lines up exactly with macOS's regular-size system glyph,
// which the app draws over it while Touch ID is armed.
const GLYPH_SIZE = 64;
const MASK = "••••••••";
const TOO_MANY = "Too many tries. Use the buttons.";
const TOO_MANY_TOUCH_ONLY = "Too many tries. This request needs Touch ID.";
const TOUCH_REQUIRED = "Touch ID required";

// Messages can arrive before React subscribes, so they are buffered here.
const inbox = { show: null, subs: new Set() };
function post(kind, data) {
  if (kind === "show") inbox.show = data;
  for (const fn of Array.from(inbox.subs)) fn(kind, data);
}
if (api) {
  api.onShow((d) => post("show", d));
  api.onResolved((d) => post("resolved", d));
  api.onTouch((d) => post("touch", d));
}
function useInbox(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const sub = (kind, data) => ref.current(kind, data);
    inbox.subs.add(sub);
    return () => { inbox.subs.delete(sub); };
  }, []);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const pad = (n) => (n < 10 ? "0" : "") + n;
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const labelCase = (k) => { const s = String(k || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); return s ? s[0].toUpperCase() + s.slice(1) : ""; };

// "Login" -> "login", but "API key" and "Wi-Fi network" keep their capitals.
function inSentence(label) {
  const [first, ...rest] = String(label).split(" ");
  const word = /[A-Z]/.test(first.slice(1)) ? first : first.toLowerCase();
  return [word].concat(rest).join(" ");
}

function fmtValue(v) {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map(fmtValue).filter(Boolean).join(", ");
  if (typeof v === "object") { try { return JSON.stringify(v); } catch (e) { return ""; } }
  return String(v);
}

function useNow(ms) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function useSystemDark() {
  const q = React.useMemo(() => (window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null), []);
  const [dark, setDark] = useState(q ? q.matches : false);
  useEffect(() => {
    if (!q) return;
    const f = (e) => setDark(e.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, [q]);
  return dark;
}

// A new assistant asking to use the vault (pm mcp serve without a token).
function describeConnect(tx) {
  const entry = tx.entry || {};
  const f = entry.f && typeof entry.f === "object" ? entry.f : {};
  const args = tx.args && typeof tx.args === "object" ? tx.args : {};
  const client = clip(String(f.client || args.client || entry.name || tx.client || "An assistant"), 60);
  const version = clip(String(f.version || args.version || ""), 24);
  const access = [].concat(f.access || args.access || []).map((x) => clip(fmtValue(x), 80)).filter(Boolean).slice(0, 8);
  return {
    op: "connect",
    client,
    title: client + " wants to use your vault",
    subtitle: "It can read your items and ask to change them. You approve every change.",
    meta: [<>via <code>pm mcp serve</code></>, version ? client + " " + version : client],
    item: { icon: "bot", name: client, type: "AI assistant" },
    rows: access.map((label) => ({ label })),
    verb: "allow", approveLabel: "Allow", rejectLabel: "Don't allow", touchCaption: "Touch ID to allow", okCaption: "Allowed", noCaption: "Not allowed"
  };
}

// MCP item types (the tools' "category"/"type") as the app's type ids.
const MCP_TYPES = {
  password: "password", totp: "totp", token: "token", note: "note", api_key: "apikey", ssh_key: "ssh_key",
  wifi: "wifi", recovery_code: "recovery", certificate: "certificate", banking: "banking", document: "document",
  gov_id: "govid", medical: "medical", travel: "travel", contact: "contact", cloud: "cloud", k8s_secret: "k8s",
  docker: "docker", ssh_config: "ssh_config", cicd: "cicd", license: "license", contract: "legal",
  audio: "audio", video: "video", photo: "photo"
};
const READ_OPS = new Set(["get_entry", "decrypt_entry", "get_totp", "search_vault"]);

// An assistant asking to see secrets (MCP settings: "Ask before secrets").
function describeRead(tx) {
  const entry = tx.entry || {};
  const f = entry.f && typeof entry.f === "object" ? entry.f : {};
  const client = clip(String(tx.client || "An assistant"), 60);
  const allow = { verb: "allow", approveLabel: "Allow", rejectLabel: "Don't allow", touchCaption: "Touch ID to allow", okCaption: "Allowed", noCaption: "Not allowed" };
  const meta = [<>via <code>pm mcp serve</code></>, <>token <code>{client}</code></>];
  if (tx.op === "search_vault") {
    const query = clip(fmtValue(f.query) || "", 80);
    return Object.assign({
      op: "read", client, meta, rows: [],
      title: client + " wants to search your vault",
      subtitle: "It will see the full contents of every item that matches “" + query + "”.",
      item: { icon: "lock", name: query || "Everything", type: "Search" }
    }, allow);
  }
  const name = clip(String(entry.name || fmtValue(f.name) || fmtValue(f.path) || "an item"), 80);
  const cat = fmtValue(f.category || entry.type || "");
  const known = TYPES.find((t) => t.id === (MCP_TYPES[cat] || cat));
  const totp = tx.op === "get_totp";
  return Object.assign({
    op: "read", client, meta, rows: [],
    title: totp ? client + " wants a 2FA code for “" + name + "”" : client + " wants to read “" + name + "”",
    subtitle: "It will see this item's secrets.",
    item: { icon: "key-round", name, type: totp ? "2FA code" : known ? known.label : "Vault item" }
  }, allow);
}

// Everything the sheet says about a request.
function describe(tx) {
  if (tx && tx.op === "connect") return describeConnect(tx);
  if (tx && READ_OPS.has(tx.op)) return describeRead(tx);
  const entry = (tx && tx.entry) || {};
  const f = entry.f && typeof entry.f === "object" ? entry.f : {};
  const known = TYPES.find((t) => t.id === entry.type);
  const type = known || getType("note");
  const typeLabel = known ? known.label : labelCase(entry.type) || "Item";
  const name = clip(String(entry.name || f.name || tx.summary || "an item"), 80);
  const client = clip(String(tx.client || "An assistant"), 60);
  const space = entry.space && String(entry.space).toLowerCase() !== "default" ? labelCase(entry.space) : "";
  const op = tx.op === "delete_entry" ? "delete" : tx.op === "edit_entry" ? "change" : "add";
  const title = client + " wants to " + op + " “" + name + "”";
  const subtitle = op === "add" ? "A new " + inSentence(typeLabel) + " in " + (space || "your vault") + "."
    : op === "change" ? "It will change this " + inSentence(typeLabel) + "."
    : "You can undo this in History.";
  const rows = [];
  for (const [k, v] of Object.entries(f)) {
    if (k === "name") continue;
    const text = clip(fmtValue(v), 120);
    if (!text) continue;
    const def = type.fields.find((x) => x.key === k);
    const secret = /^•+$/.test(text);
    const row = { label: def && known ? def.label : labelCase(k), value: secret ? MASK : text, secret };
    if (op === "change") row.badge = { label: "Changed", tone: "warning" };
    rows.push(row);
  }
  if (space && op !== "change") rows.push({ label: "Space", value: space });
  const del = op === "delete";
  return {
    op, client, title, subtitle,
    meta: [<>via <code>pm mcp serve</code></>, <>token <code>{client}</code></>],
    item: { icon: type.icon, name, type: typeLabel },
    rows: rows.slice(0, 8),
    verb: del ? "delete" : "approve", approveLabel: del ? "Delete" : "Approve", approveTone: del ? "danger" : "primary", rejectLabel: "Reject",
    touchCaption: del ? "Touch ID to delete" : "Touch ID to approve", okCaption: del ? "Deleted" : "Approved", noCaption: "Rejected"
  };
}

function errorText(res) {
  const m = res && res.error && res.error.message;
  return m ? clip(String(m), 160) : "Something went wrong. Try again.";
}

function Sheet({ tx, touchId, dark, onGone }) {
  const d = React.useMemo(() => describe(tx), [tx]);
  const verb = d.verb;
  const glyph = useRef(null);
  const phase = useRef("pending"); // pending | deciding | leaving
  const [, rerender] = useState(0);
  const setPhase = (p) => { phase.current = p; rerender((n) => n + 1); };
  const [cap, setCap] = useState(null); // { text, tone } over the default caption
  const [armed, setArmed] = useState(false);
  const [frozen, setFrozen] = useState(null); // holds the glyph's native look while it ticks
  const [showGlyph, setShowGlyph] = useState(false); // keys mode: the tick plays on approve
  const [locked, setLocked] = useState(false);
  // MCP settings can require Touch ID; once Touch ID goes away the buttons approve again.
  const [touchGone, setTouchGone] = useState(false);
  const touchOnly = touchId && tx.approveWith === "touchid" && !touchGone;
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const fails = useRef(0);
  const resolved = useRef(false);
  const capTimer = useRef(0);
  const afterCommit = useRef([]);
  const alive = useRef(true);
  const now = useNow(250);

  useEffect(() => () => { alive.current = false; clearTimeout(capTimer.current); }, []);
  // Runs glyph animations once React has applied a change to the glyph.
  useEffect(() => {
    const list = afterCommit.current;
    afterCommit.current = [];
    list.forEach((fn) => fn());
  });
  const later = (fn) => { afterCommit.current.push(fn); rerender((n) => n + 1); };

  // The system glyph is drawn over ours once the sheet has stopped moving.
  useEffect(() => {
    if (reducedMotion()) { setEntered(true); return; }
    const t = setTimeout(() => setEntered(true), ENTER_FALLBACK_MS);
    const onEnd = (e) => { if (e.animationName === "apm-approval-in") setEntered(true); };
    document.addEventListener("animationend", onEnd);
    return () => { clearTimeout(t); document.removeEventListener("animationend", onEnd); };
  }, []);

  const wantSlot = touchId && entered && phase.current === "pending" && !locked;
  useEffect(() => {
    if (!api) return;
    if (!wantSlot) { api.touchSlot(null); return; }
    const report = () => {
      const el = glyph.current && glyph.current.el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      api.touchSlot({ x: r.left, y: r.top, width: r.width, height: r.height, dark });
    };
    report();
    window.addEventListener("resize", report);
    return () => window.removeEventListener("resize", report);
  }, [wantSlot, dark]);

  const leave = useCallback(async () => {
    if (phase.current === "leaving") return;
    setPhase("leaving");
    clearTimeout(capTimer.current);
    setLeaving(true);
    await sleep(reducedMotion() ? 0 : LEAVE_MS);
    onGone(tx.id);
  }, [tx.id, onGone]);

  const setCaption = (text, tone, resetAfter) => {
    clearTimeout(capTimer.current);
    setCap(text == null ? null : { text, tone: tone || "neutral" });
    if (resetAfter) capTimer.current = setTimeout(() => { if (alive.current && phase.current === "pending") setCap(null); }, resetAfter);
  };

  const nativeNow = touchId && armed;

  async function approve(via) {
    if (phase.current !== "pending" || !api) return;
    if (touchOnly && via !== "touchid") return;
    setPhase("deciding");
    clearTimeout(capTimer.current);
    if (cap && cap.tone === "err" && !locked) setCap(null);
    setFrozen(nativeNow || via === "touchid");
    const ticked = new Promise((resolve) => {
      const run = () => (glyph.current ? glyph.current.tick() : Promise.resolve(false)).then(resolve);
      if (touchId) { glyph.current && glyph.current.dim(false); later(run); } else { setShowGlyph(true); later(run); }
    });
    const [res] = await Promise.all([api.decide(tx.id, true, via), ticked]);
    if (!alive.current) return;
    if (res && res.ok) {
      setCaption(d.okCaption, "ok");
      await sleep(HOLD_MS);
      if (alive.current) leave();
      return;
    }
    setCaption(errorText(res), "err");
    if (resolved.current) return;
    if (glyph.current) glyph.current.reset();
    setFrozen(null);
    setShowGlyph(false);
    if (locked && glyph.current) glyph.current.dim(true);
    setPhase("pending");
  }

  async function reject(via) {
    if (phase.current !== "pending" || !api) return;
    setPhase("deciding");
    const res = await api.decide(tx.id, false, via);
    if (!alive.current) return;
    if (res && res.ok) { setCaption(d.noCaption); leave(); return; }
    setCaption(errorText(res), "err");
    if (!resolved.current) setPhase("pending");
  }

  useInbox((kind, data) => {
    if (!data || phase.current === "leaving") return;
    if (kind === "resolved" && data.id === tx.id) {
      resolved.current = true;
      const s = data.status;
      if (s === "approved" || s === "committed") setCaption(d.okCaption, "ok");
      else if (s === "rejected" || s === "aborted") setCaption(d.noCaption);
      else if (s === "expired") setCaption("This request expired.");
      else if (s === "failed") setCaption("APM could not make the change.", "err");
      sleep(HOLD_MS).then(() => { if (alive.current) leave(); });
      return;
    }
    if (kind !== "touch" || !touchId) return;
    if (data.ok === undefined) { if (typeof data.armed === "boolean") setArmed(data.armed); return; }
    if (data.ok === true) {
      // Keep the ridges hidden: the system glyph has just gone and ours ticks.
      setFrozen(true);
      setArmed(false);
      approve("touchid");
      return;
    }
    if (phase.current !== "pending") return;
    setArmed(false);
    const code = data.code;
    fails.current = code === "failed" ? fails.current + 1 : MAX_FAILS;
    const lockNow = fails.current >= MAX_FAILS;
    if (lockNow) setLocked(true);
    // Touch ID itself is gone (not enrolled, or the system locked it): the buttons approve.
    const gone = code === "unavailable" || code === "lockout";
    if (gone) setTouchGone(true);
    const lockText = code === "unavailable" ? "Touch ID isn't available. Use the buttons." : touchOnly && !gone ? TOO_MANY_TOUCH_ONLY : TOO_MANY;
    setCaption(lockNow ? lockText : "Not recognized. Try again.", "err", lockNow ? 0 : ERR_RESET_MS);
    later(() => {
      if (!glyph.current) return;
      glyph.current.fail().then(() => {
        if (!alive.current || !lockNow || phase.current !== "pending") return;
        if (glyph.current) glyph.current.dim(true);
        setCap((c) => (c ? { text: c.text, tone: "neutral" } : c));
      });
    });
  });

  // The page owns the keys: Esc rejects; Space approves without Touch ID
  // (with Touch ID, and so whenever a request needs Touch ID, it does nothing).
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { e.preventDefault(); reject("keyboard"); return; }
      if (e.key === " " || e.code === "Space") {
        if (touchId || e.repeat) return;
        const t = e.target;
        if (t && t.closest && t.closest("button")) return; // Space presses a focused button
        e.preventDefault();
        approve("keyboard");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const native = frozen !== null ? frozen : nativeNow;
  const hasGlyph = touchId || showGlyph;
  const defaultCaption = touchId ? d.touchCaption
    : <>Press <A.Kbd>Space</A.Kbd> to {verb} · <A.Kbd>Esc</A.Kbd> to {d.op === "connect" || d.op === "read" ? "decline" : "reject"}</>;
  const caption = cap ? cap.text : showGlyph ? "" : defaultCaption;
  const meta = d.meta.concat([<>expires in {mmss(Number(tx.expires) - now)}</>]);

  return (
    <A.ApprovalSheet
      title={d.title}
      subtitle={d.subtitle}
      meta={meta}
      item={d.item}
      rows={d.rows}
      touch={hasGlyph ? <A.TouchIdGlyph ref={glyph} size={GLYPH_SIZE} ridges={touchId} native={native} label={touchId ? "Touch ID" : undefined} /> : null}
      caption={caption}
      captionTone={cap ? cap.tone : "neutral"}
      approveLabel={d.approveLabel}
      approveTone={d.approveTone || "primary"}
      approveKbd={touchId ? undefined : "Space"}
      approveDisabled={touchOnly}
      approveHint={touchOnly ? TOUCH_REQUIRED : undefined}
      rejectLabel={d.rejectLabel}
      rejectKbd="Esc"
      onApprove={() => approve("click")}
      onReject={() => reject("click")}
      busy={phase.current === "deciding"}
      leaving={leaving}
    />
  );
}

function App() {
  const [cur, setCur] = useState(() => inbox.show);
  const [touchInfo, setTouchInfo] = useState(false);
  const dark = useSystemDark();
  const stage = useRef(null);

  useEffect(() => {
    if (!api) return;
    api.info().then((i) => setTouchInfo(!!(i && i.touchId)), () => {});
  }, []);

  useInbox((kind, data) => {
    if (kind === "show" && data && data.tx && data.tx.id) setCur(data);
  });

  const onGone = useCallback((id) => setCur((c) => (c && c.tx.id === id ? null : c)), []);

  // The panel is sized to the sheet; 0 tells main the sheet has gone.
  useEffect(() => {
    const el = stage.current;
    if (!el || !api) return;
    let last = -1;
    const report = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h !== last) { last = h; api.size(h); }
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const touchId = !!(cur && (cur.touchId !== undefined ? cur.touchId : touchInfo));
  return (
    <div className="approval-stage" ref={stage}>
      {cur && <Sheet key={cur.tx.id} tx={cur.tx} touchId={touchId} dark={dark} onGone={onGone} />}
    </div>
  );
}

if (!A || !A.ApprovalSheet || !A.TouchIdGlyph) console.error("The design system bundle has no ApprovalSheet or TouchIdGlyph. Run npm run ds:sync.");
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
