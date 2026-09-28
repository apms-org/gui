import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { getType, titleOf, subOf, TYPES, primaryValue } from "../lib/types.js";
import { ui, useUi, openUrl } from "../lib/ui.js";
import { analyze } from "../lib/health.js";
import { Vault, TypeNav, visibleItems } from "./vault.jsx";
import { SpaceSwitcher } from "./spaces.jsx";
import { DialogHost } from "./dialogs.jsx";
import { Authenticator } from "./authenticator.jsx";
import { Watchtower } from "./watchtower.jsx";
import { History } from "./history.jsx";
import { Settings } from "../settings/settings.jsx";
import { copied } from "./fields.jsx";
import { linkedTotp } from "./detail.jsx";

const cx = U.cx;

function Traffic() { return <div className="traffic" aria-hidden="true"><i /><i /><i /></div>; }

function Sidebar({ analysis, theme, onTheme }) {
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const session = useStore((s) => s.session);
  const u = useUi();
  const [collapsed, setCollapsed] = React.useState(true);
  const r = u.route;
  const space = prefs.space ?? "all";
  const within = (i) => space === "all" || (i.space || "") === space;
  const pick = (filter) => { ui.go({ view: "vault", filter }); ui.query(""); };
  const pendingAi = disk.mcp.tx.filter((t) => t.status === "pending").length;
  const sync = disk.sync.providers.filter((p) => p.connected);
  const syncing = useStore((s) => !!s.busy.sync);
  const [, tick] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const t = setInterval(tick, 20000); return () => clearInterval(t); }, []);
  return (
    <aside className="side" aria-label="Sidebar">
      <div className="side-top drag">
        <div className="nodrag side-top-actions">
          <A.IconButton icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Light theme" : "Dark theme"} onClick={onTheme} />
          <A.IconButton icon="panel-left" label="Hide sidebar" kbd={["⇧", "⌘", "B"]} onClick={() => store.savePrefs({ sidebar: false })} />
        </div>
      </div>
      <div className="side-scroll">
        <SpaceSwitcher />
        <button type="button" className="side-search" onClick={() => ui.cmd(true)}><A.Icon name="search" size={15} /><span>Search</span><A.Kbd keys={["⌘", "K"]} /></button>
        <nav className="side-group" aria-label="Library">
          <A.NavItem icon="layers" label="All items" count={disk.items.filter(within).length} active={r.view === "vault" && r.filter === "all"} onClick={() => pick("all")} />
          <A.NavItem icon="star" label="Favorites" count={disk.items.filter((i) => i.fav && within(i)).length} active={r.view === "vault" && r.filter === "fav"} onClick={() => pick("fav")} />
          <A.NavItem icon="timer" label="Authenticator" count={disk.items.filter((i) => i.type === "totp" && within(i)).length} active={r.view === "authenticator"} onClick={() => ui.go({ view: "authenticator" })} />
          <A.NavItem icon="radar" label="Watchtower" badge={analysis.issues.length ? { tone: analysis.issues.some((x) => x.tone === "danger") ? "danger" : "warning", text: String(analysis.issues.length) } : null} count={analysis.issues.length ? null : 0} active={r.view === "watchtower"} onClick={() => ui.go({ view: "watchtower" })} />
          <A.NavItem icon="history" label="History" active={r.view === "history"} onClick={() => ui.go({ view: "history" })} />
        </nav>
        <TypeNav filter={r.view === "vault" ? r.filter : ""} disk={disk} space={space} onPick={pick} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      <div className="side-foot">
        {pendingAi > 0 && <button type="button" className="side-alert" onClick={() => ui.go({ view: "settings", section: "ai" })}><A.Icon name="bot" size={14} /><span><b>{pendingAi} AI request{pendingAi === 1 ? "" : "s"}</b> waiting for approval</span><A.Icon name="chevron-right" size={13} /></button>}
        {session.readonly && <div className="side-alert is-ro"><A.Icon name="eye" size={14} /><span><b>Read-only</b> until {new Date(session.readonlyUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>}
        <button type="button" className="sync" title="Encrypted before upload" onClick={() => ui.go({ view: "settings", section: "sync" })}>
          <A.Icon name={sync.length ? (syncing ? "refresh-cw" : "cloud-check") : "cloud-off"} size={14} className={cx(syncing && "spin", sync.length && !syncing && "is-ok")} />
          <span>{sync.length ? (syncing ? <b>Syncing</b> : <><b>{sync.some((p) => p.state === "error") ? "Sync failed" : "Synced"}</b> to {sync.length === 1 ? providerName(sync[0].id) : sync.length + " places"}</>) : "Local only"}</span>
          <span className="sync-time">{sync.length && !syncing ? U.ago(Math.max(disk.sync.lastSync || 0, ...sync.map((p) => p.last || 0))) : ""}</span>
        </button>
        <A.NavItem icon="trash-2" label="Trash" count={disk.trash.length} active={r.view === "vault" && r.filter === "trash"} onClick={() => pick("trash")} />
        <A.NavItem icon="settings" label="Settings" kbd={["⌘", ","]} active={r.view === "settings"} onClick={() => ui.go({ view: "settings" })} />
        <A.NavItem icon="lock" label="Lock vault" kbd={["⌘", "L"]} onClick={() => act.lock("manual")} />
      </div>
    </aside>
  );
}
export const providerName = (id) => ({ github: "GitHub", gdrive: "Google Drive", dropbox: "Dropbox" }[id] || id);

function CommandHost({ disk, onTheme }) {
  const u = useUi();
  if (!u.cmd) return null;
  const openItem = (i) => { ui.go({ view: "vault", filter: "all" }); ui.query(""); ui.select(i.id); };
  const items = disk.items.slice().sort((a, b) => (b.fav - a.fav) || (b.used - a.used)).map((i) => ({ id: i.id, label: titleOf(i), hint: subOf(i) || getType(i.type).label, keywords: getType(i.type).label + " " + (i.space || ""), tile: i.type === "password" ? { name: titleOf(i) } : { icon: getType(i.type).icon }, onSelect: () => openItem(i) }));
  const copies = disk.items.filter((i) => getType(i.type).primary && primaryValue(i)).slice(0, 60).map((i) => ({ id: "c" + i.id, label: "Copy " + (getType(i.type).fields.find((x) => x.key === getType(i.type).primary) || {}).label.toLowerCase() + ": " + titleOf(i), icon: "copy", keywords: "copy " + titleOf(i), onSelect: () => { copied((getType(i.type).fields.find((x) => x.key === getType(i.type).primary) || {}).label || "secret", primaryValue(i), true, disk.settings.clipboard); act.used(i.id); } }));
  const nav = [
    { label: "All items", icon: "layers", onSelect: () => ui.go({ view: "vault", filter: "all" }) },
    { label: "Favorites", icon: "star", onSelect: () => ui.go({ view: "vault", filter: "fav" }) },
    { label: "Authenticator", icon: "timer", kbd: ["⌥", "⌘", "2"], onSelect: () => ui.go({ view: "authenticator" }) },
    { label: "Watchtower", icon: "radar", kbd: ["⌥", "⌘", "3"], onSelect: () => ui.go({ view: "watchtower" }) },
    { label: "History", icon: "history", kbd: ["⌥", "⌘", "4"], onSelect: () => ui.go({ view: "history" }) },
    { label: "Trash", icon: "trash-2", onSelect: () => ui.go({ view: "vault", filter: "trash" }) },
    ...TYPES.map((t) => ({ label: t.plural, icon: t.icon, keywords: "type " + t.label, onSelect: () => ui.go({ view: "vault", filter: "type:" + t.id }) }))
  ];
  const actions = [
    { label: "New item", icon: "plus", kbd: ["⌘", "N"], onSelect: () => ui.open("new") },
    ...TYPES.slice(0, 25).map((t) => ({ label: "New " + t.label.toLowerCase(), icon: t.icon, keywords: "add create " + t.plural, onSelect: () => ui.open("new", { type: t.id }) })),
    { label: "Generate password", icon: "dices", kbd: ["⌘", "G"], onSelect: () => ui.open("generator") },
    { label: "New space", icon: "folder-plus", kbd: ["⇧", "⌘", "N"], onSelect: () => ui.open("space-new") },
    { label: "Sync now", icon: "refresh-cw", onSelect: async () => { const n = await act.syncNow(); ui.toast({ title: n ? "Synced to " + n + " provider" + (n === 1 ? "" : "s") : "No sync providers connected", tone: n ? "success" : "neutral" }); } },
    { label: "Import items", icon: "download", onSelect: () => ui.open("import") },
    { label: "Export items", icon: "file-down", onSelect: () => ui.open("export") },
    { label: "Undo last change", icon: "undo-2", kbd: ["⌘", "Z"], onSelect: undoLast },
    { label: "Switch theme", icon: "palette", onSelect: onTheme },
    { label: "Keyboard shortcuts", icon: "keyboard", kbd: ["⌘", "/"], onSelect: () => ui.open("shortcuts") },
    { label: "Lock vault", icon: "lock", kbd: ["⌘", "L"], onSelect: () => act.lock("manual") }
  ];
  const settings = [["general", "General"], ["security", "Security"], ["recovery", "Recovery"], ["sessions", "Sessions"], ["appearance", "Appearance"], ["spaces", "Spaces"], ["sync", "Sync"], ["passkeys", "Passkeys and extension"], ["ai", "AI access"], ["import", "Import and export"], ["developer", "Developer"], ["maintenance", "Maintenance"], ["alerts", "Alerts"], ["about", "About"]].map(([id, label]) => ({ label: "Settings: " + label, icon: "settings", onSelect: () => ui.go({ view: "settings", section: id }) }));
  return <A.CommandMenu open onClose={() => ui.cmd(false)} placeholder="Search items, actions and settings" groups={[{ label: "Items", items, limit: 8, idleLimit: 5 }, { label: "Actions", items: actions, limit: 6, idleLimit: 5 }, { label: "Copy", items: copies, limit: 5, idleLimit: 0 }, { label: "Go to", items: nav, limit: 6, idleLimit: 4 }, { label: "Settings", items: settings, limit: 5, idleLimit: 0 }]} />;
}

export async function undoLast() {
  const r = await act.undo(1);
  ui.toast(r.ok ? { title: "Undone", description: "Vault restored to the previous version.", icon: "undo-2" } : { title: r.error, tone: "danger" });
}

function ToastHost() {
  const u = useUi();
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const t = u.toast;
  const head = disk && disk.commits[0];
  const receipt = t && !t.action && !t.countdown && t.tone !== "neutral" && prefs.receipts !== false && head && t.tone !== "danger" && Math.abs(Math.floor(t.key) - head.ts) < 6000 ? head.id.slice(-7) : null;
  React.useEffect(() => { if (!t || t.countdown) return; const x = setTimeout(() => ui.clearToast(t.key), t.duration || 2400); return () => clearTimeout(x); }, [t && t.key]);
  if (!t) return null;
  return <div className="toast-slot"><A.Toast key={t.key} title={t.title} description={t.description} tone={t.tone || "success"} icon={t.icon} countdown={t.countdown} onDone={() => { ui.clearToast(t.key); }} action={t.action ? <A.Button size="sm" variant="ghost" onClick={() => { t.action.onClick(); ui.clearToast(t.key); }}>{t.action.label}</A.Button> : receipt ? <button type="button" className="receipt" title="Open this commit in History" onClick={() => { ui.go({ view: "history" }); ui.clearToast(t.key); }}><A.Icon name="git-commit-horizontal" size={13} />{receipt}</button> : null} /></div>;
}

const QL_MOTION = typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;

function qlFrom(panel, id) {
  const row = id && document.querySelector('[data-row="' + id + '"]');
  if (!row || !QL_MOTION) return null;
  const a = row.getBoundingClientRect();
  const b = panel.getBoundingClientRect();
  if (!a.width || !b.width) return null;
  const s = Math.max(0.18, Math.min(0.6, a.height * 2.4 / b.height));
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  return "translate(" + dx + "px," + dy + "px) scale(" + s + ")";
}

function QuickLook({ disk }) {
  const u = useUi();
  const [shown, setShown] = React.useState(null);
  const [closing, setClosing] = React.useState(false);
  const panel = React.useRef(null);
  const scrim = React.useRef(null);
  const origin = React.useRef(null);

  React.useEffect(() => {
    if (u.quick) {
      if (!shown || closing) origin.current = u.quick;
      if (closing) [panel.current, scrim.current].forEach((el) => el && el.getAnimations().forEach((x) => x.cancel()));
      setShown(u.quick); setClosing(false); return;
    }
    if (!shown || closing) return;
    setClosing(true);
    const p = panel.current;
    if (p) delete p.dataset.opened;
    const from = p && qlFrom(p, shown);
    const run = [];
    if (p) run.push(p.animate(from ? [{ transform: "none", opacity: 1 }, { transform: from, opacity: 0 }] : [{ transform: "none", opacity: 1 }, { transform: "scale(.96)", opacity: 0 }], { duration: from ? 240 : 140, easing: "cubic-bezier(.4,0,.7,.2)", fill: "forwards" }).finished);
    if (scrim.current) run.push(scrim.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" }).finished);
    Promise.all(run).catch(() => {}).then(() => { if (!ui.get().quick) { setShown(null); setClosing(false); } });
  }, [u.quick]);

  React.useLayoutEffect(() => {
    const p = panel.current;
    if (!p || !shown || closing || shown !== origin.current || p.dataset.opened === shown) return;
    p.dataset.opened = shown;
    const from = qlFrom(p, shown);
    p.animate(from ? [{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.35 }, { transform: "none", opacity: 1 }] : [{ transform: "scale(.96)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: from ? 420 : 180, easing: from ? "cubic-bezier(.18,1.02,.3,1.03)" : "cubic-bezier(.2,.8,.2,1)" });
    scrim.current && scrim.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  }, [shown, closing]);

  React.useEffect(() => {
    if (!shown) return;
    const k = (e) => { if (e.key === "Escape" && ui.get().quick) { e.stopPropagation(); e.preventDefault(); ui.quick(null); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [shown]);

  const it = shown && disk.items.find((i) => i.id === shown);
  if (!it) return null;
  const t = getType(it.type);
  const tot = linkedTotp(disk, it) || (it.type === "totp" ? it : null);
  return (
    <div className={cx("ql-layer", closing && "is-closing")} onMouseDown={(e) => { if (e.target === e.currentTarget) ui.quick(null); }}>
      <div className="ql-scrim" ref={scrim} />
      <div className="ql-panel" ref={panel} role="dialog" aria-modal="false" aria-label={"Quick Look: " + titleOf(it)}>
        <div className="ql-head">
          <span className="ql-icon"><A.Icon name={t.icon} size={18} /></span>
          <div className="ql-titles"><div className="ql-title">{titleOf(it)}</div><div className="ql-sub">{t.label + (it.space ? " · " + it.space : "")}</div></div>
          <A.IconButton icon="x" label="Close" size="sm" tip={false} onClick={() => ui.quick(null)} />
        </div>
        <div className="ql-body quick">
          {it.f.file && /^image/.test(it.f.file.mime || "") && <QuickImage id={it.id} mime={it.f.file.mime} />}
          {it.type === "note" && <pre className="quick-note">{String(it.f.content || "").split("\n").slice(0, 18).join("\n")}</pre>}
          {tot && <div className="quick-totp"><A.TotpCode secret={tot.f.secret.replace(/\s/g, "")} size="lg" /></div>}
          <div className="kv-list">{t.fields.filter((x) => x.key !== t.titleKey && it.f[x.key] && !["file", "note"].includes(x.kind)).slice(0, 6).map((x) => <div className="kv" key={x.key}><div className="kv-label">{x.label}</div><div className={cx("kv-value", x.mono && "is-mono")}>{["password", "secret", "secretBlock", "totp", "codes"].includes(x.kind) ? "••••••••••" : Array.isArray(it.f[x.key]) ? it.f[x.key].join(", ") : String(it.f[x.key])}</div></div>)}</div>
        </div>
        <div className="ql-foot"><span>Space or Esc to close</span><A.Button size="sm" variant="ghost" onClick={() => { const id = it.id; ui.quick(null); ui.select(id); }}>Open item</A.Button></div>
      </div>
    </div>
  );
}

function QuickImage({ id, mime }) {
  const [src, setSrc] = React.useState(null);
  React.useEffect(() => { let live = true; act.itemFile(id).then((r) => { if (live && r && r.data) setSrc("data:" + (r.mime || mime) + ";base64," + r.data); }); return () => { live = false; }; }, [id]);
  return src ? <img className="filepreview-img" src={src} alt="" /> : null;
}

function runMenu(action, disk, session) {
  const u = ui.get();
  const sel = u.route.view === "vault" && u.selected && disk.items.find((i) => i.id === u.selected);
  if (action === "new-item") { if (!session.readonly) ui.open("new"); return; }
  if (action === "lock") { act.lock("manual"); return; }
  if (action === "settings") { ui.go({ view: "settings" }); return; }
  if (action === "search") { ui.cmd(true); return; }
  if (action === "generator") { ui.open("generator"); return; }
  if (action === "space-new") { ui.open("space-new"); return; }
  if (action === "import") { if (!session.readonly) ui.open("import"); return; }
  if (action === "export") { ui.open("export"); return; }
  if (action === "shortcuts") { ui.open("shortcuts"); return; }
  if (action === "find") { ui.go({ view: "vault" }); setTimeout(() => { const el = document.querySelector(".list-search input"); el && el.focus(); }, 30); return; }
  if (action === "toggle-sidebar") { store.savePrefs({ sidebar: !store.get().prefs.sidebar }); return; }
  if (action === "undo") { undoLast(); return; }
  if (action.startsWith("view-")) { ui.go({ view: action.slice(5), filter: "all" }); return; }
  if (!sel) { ui.toast({ title: "Select an item first", tone: "neutral" }); return; }
  const t = getType(sel.type);
  if (action === "copy-password") { const v = primaryValue(sel); if (v) { copied((t.fields.find((x) => x.key === t.primary) || {}).label || "secret", v, true, disk.settings.clipboard); act.used(sel.id); } else ui.toast({ title: "Nothing to copy", tone: "neutral" }); return; }
  if (action === "copy-username") { if (sel.f.username) copied("username", sel.f.username, false); else ui.toast({ title: "No username on this item", tone: "neutral" }); }
}

export function Shell({ theme, onTheme }) {
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const session = useStore((s) => s.session);
  const u = useUi();
  const analysis = React.useMemo(() => analyze(disk), [disk && disk.meta.modified, disk && disk.items.length, disk && disk.meta.alerts, disk && disk.meta.profile]);

  React.useEffect(() => {
    const onKey = (e) => {
      act.activity();
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (u.dialog && k !== "k") return;
      if (k === "k") { e.preventDefault(); ui.cmd(!u.cmd); return; }
      if (k === "l") { e.preventDefault(); act.lock("manual"); return; }
      if (k === "n" && e.shiftKey) { e.preventDefault(); ui.open("space-new"); return; }
      if (k === "n") { e.preventDefault(); if (!session.readonly) ui.open("new"); return; }
      if (k === ",") { e.preventDefault(); ui.go({ view: "settings" }); return; }
      if (k === "/") { e.preventDefault(); ui.open("shortcuts"); return; }
      if (k === "g" && !e.shiftKey) { e.preventDefault(); ui.open("generator"); return; }
      if (k === "b" && e.shiftKey) { e.preventDefault(); store.savePrefs({ sidebar: !prefs.sidebar }); return; }
      if (k === "z" && !e.shiftKey && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); if (!session.readonly) undoLast(); return; }
      if (e.altKey && /^[1-5]$/.test(e.code.slice(-1))) { e.preventDefault(); const v = ["vault", "authenticator", "watchtower", "history", "settings"][Number(e.code.slice(-1)) - 1]; ui.go({ view: v, filter: "all" }); return; }
      const sel = u.route.view === "vault" && u.selected && disk.items.find((i) => i.id === u.selected);
      if (e.shiftKey && sel) {
        const t = getType(sel.type);
        if (k === "c") { e.preventDefault(); const v = primaryValue(sel); if (v) { copied((t.fields.find((x) => x.key === t.primary) || {}).label || "secret", v, true, disk.settings.clipboard); act.used(sel.id); } else ui.toast({ title: "Nothing to copy", tone: "neutral" }); return; }
        if (k === "u") { e.preventDefault(); if (sel.f.username) copied("username", sel.f.username, false); else ui.toast({ title: "No username on this item", tone: "neutral" }); return; }
        if (k === "t") { e.preventDefault(); const tt = linkedTotp(disk, sel) || (sel.type === "totp" ? sel : null); if (tt) A.totp(tt.f.secret.replace(/\s/g, "")).then((c) => copied("one-time code", c, true, disk.settings.clipboard)); else ui.toast({ title: "No one-time code for this item", tone: "neutral" }); return; }
        if (k === "o") { e.preventDefault(); const url = sel.f.website || (sel.f.urls || [])[0] || sel.f.registry_url; if (url) openUrl(url); else ui.toast({ title: "No website on this item", tone: "neutral" }); return; }
      }
      if (/^[1-9]$/.test(e.key) && !e.altKey && !e.shiftKey) { e.preventDefault(); const f = ["all", "type:password", "type:totp", "type:token", "type:apikey", "type:ssh_key", "type:note", "type:cloud", "type:banking"][Number(e.key) - 1]; ui.go({ view: "vault", filter: f }); return; }
    };
    const onMove = () => act.activity();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousemove", onMove); };
  });

  React.useEffect(() => {
    const t = setInterval(() => {
      const s = store.get().session;
      const st = store.get().disk ? store.get().disk.settings : disk.settings;
      const idleMin = Number(st.inactivity || 15);
      const maxMin = Number(st.sessionTimeout || 60);
      if (s.unlocked && Date.now() - s.lastActive > idleMin * 60000) act.lock("idle");
      else if (s.unlocked && Date.now() - s.unlockedAt > maxMin * 60000) act.lock("expired");
      if (s.readonly && s.readonlyUntil && Date.now() > s.readonlyUntil) act.endReadonly();
    }, 5000);
    const ev = (e) => { const d = e.detail || {}; if (d.name) ui.open(d.name, d.props); };
    const offMenu = window.apm ? window.apm.on("menu", (d) => { const S = store.get(); if (S.disk && S.session.unlocked && d && d.action) runMenu(d.action, S.disk, S.session); }) : null;
    const go = (e) => ui.go(e.detail || {});
    window.addEventListener("apm:open", ev); window.addEventListener("apm:go", go);
    return () => { clearInterval(t); if (offMenu) offMenu(); window.removeEventListener("apm:open", ev); window.removeEventListener("apm:go", go); };
  }, []);

  const view = u.route.view;
  return (
    <div className={cx("shell", !prefs.sidebar && "no-side")}>
      {prefs.sidebar ? <Sidebar analysis={analysis} theme={theme} onTheme={onTheme} /> : <div className="side-collapsed drag"><div className="nodrag"><A.IconButton icon="panel-left" label="Show sidebar" kbd={["⇧", "⌘", "B"]} onClick={() => store.savePrefs({ sidebar: true })} /></div></div>}
      <div className="main" key={view}>
        {view === "vault" && <Vault analysis={analysis} />}
        {view === "authenticator" && <Authenticator />}
        {view === "watchtower" && <Watchtower analysis={analysis} />}
        {view === "history" && <History />}
        {view === "settings" && <Settings theme={theme} onTheme={onTheme} />}
      </div>
      <CommandHost disk={disk} onTheme={onTheme} />
      <QuickLook disk={disk} />
      <DialogHost />
      <ToastHost />
    </div>
  );
}
