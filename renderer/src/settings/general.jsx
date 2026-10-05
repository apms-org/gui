import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { ui, openUrl } from "../lib/ui.js";
import { SPACE_COLORS, SpaceDot } from "../screens/spaces.jsx";
import { Card, Head } from "./common.jsx";

const cx = U.cx;

export function General() {
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const info = useStore((s) => s.info) || {};
  const status = useStore((s) => s.status) || {};
  const m = disk.meta;
  const st = disk.settings;
  const [name, setName] = React.useState(m.name);
  React.useEffect(() => { setName(m.name); }, [m.name]);
  const path = status.path || m.path;
  return (
    <>
      <Head title="General" description="The vault file on this Mac and how the app behaves." cli="pm info" />
      <Card title="Vault" description="Shown in the window title and on the lock screen."
        footNote={<span>Saved inside the encrypted <span className="mono-inline">vault.dat</span>. pm ignores it.</span>}
        footer={<A.Button size="sm" variant="primary" disabled={!name.trim() || name === m.name || disk.readonly} onClick={async () => { const r = await act.meta({ name: name.trim() }); if (r.ok) ui.toast({ title: "Vault renamed" }); }}>Save</A.Button>}>
        <A.Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={48} />
      </Card>
      <Card title="Vault file" flush cli="pm loaded">
        <A.SettingRow title="Location" description={<span className="mono-inline path-wrap">{String(path || "").replace(/^\/Users\/[^/]+/, "~")}</span>}><A.Button size="sm" icon="folder-open" onClick={() => window.apm.shell.showItemInFolder(path)}>Show in Finder</A.Button></A.SettingRow>
        <A.SettingRow title="Size" description={U.n(disk.items.length, "item") + ", " + U.n(disk.spaces.length, "space") + ", " + disk.trash.length + " in Trash"}><span className="mono">{status.size ? U.bytes(status.size) : "unknown"}</span></A.SettingRow>
        <A.SettingRow title="Last changed" description={m.created ? "Created " + U.date(m.created) : "Created before APM tracked it"}><span>{m.modified || status.modified ? U.agoLong(m.modified || status.modified) : "unknown"}</span></A.SettingRow>
        <A.SettingRow title="Format" description="The same file pm reads and writes"><A.Badge outline>APMVAULT v4</A.Badge></A.SettingRow>
      </Card>
      <Card title="Behavior" flush>
        <A.SettingRow title="Open to" description="What you see after unlocking." htmlFor="open-to"><A.Select id="open-to" size="sm" value={st.openOnLaunch} onChange={(v) => act.settings({ openOnLaunch: v })} options={[{ value: "all", label: "All items" }, { value: "fav", label: "Favorites" }, { value: "last", label: "Last viewed" }, { value: "authenticator", label: "Authenticator" }]} /></A.SettingRow>
        <A.SettingRow title="Copy on click" description="Clicking a secret field copies it instead of selecting the text."><A.Switch label="Copy on click" checked={!!st.copyOnClick} onChange={(v) => act.settings({ copyOnClick: v })} /></A.SettingRow>
        <A.SettingRow title="Confirm before deleting" description="Items go to Trash either way, and stay there until you empty it."><A.Switch label="Confirm before deleting" checked={!!st.confirmDelete} onChange={(v) => act.settings({ confirmDelete: v })} /></A.SettingRow>
        <A.SettingRow title="Sounds" description="A soft chime when the vault unlocks and locks."><A.Switch label="Sounds" checked={!!prefs.sounds} onChange={(v) => store.savePrefs({ sounds: v })} /></A.SettingRow>
      </Card>
      <Card title="Updates" cli="pm update" footNote="Opens the releases page. Nothing about your vault is sent."
        footer={<A.Button size="sm" icon="external-link" onClick={() => openUrl("https://github.com/aaravmaloo/apm/releases")}>See releases</A.Button>}>
        <div className="version-row">
          <A.Mark size={36} tile />
          <div className="stack-2"><b>APM {info.version || ""}</b><span className="muted small">{[info.platform === "darwin" ? "macOS" : info.platform, info.arch === "arm64" ? "Apple silicon" : info.arch].filter(Boolean).join(" · ")}</span></div>
        </div>
      </Card>
    </>
  );
}

export function SpacesSettings() {
  const disk = useStore((s) => s.disk);
  const count = (n) => disk.items.filter((i) => (i.space || "") === n).length;
  const rows = [{ id: "", name: "Default", color: 7, fixed: true }].concat(disk.spaces);
  return (
    <>
      <Head title="Spaces" cli="pm space list" description="Separate groups of items inside one vault, like Work and Family. Every space shares the same master password." actions={<A.Button size="sm" variant="primary" icon="folder-plus" kbd={["⇧", "⌘", "N"]} onClick={() => ui.open("space-new")}>New space</A.Button>} />
      <Card flush>
        {rows.map((s) => (
          <div key={s.id || "default"} className="space-row">
            <ColorPick value={s.color} disabled={s.fixed || disk.readonly} onChange={(c) => act.spaceColor(s.id, c)} />
            <div className="space-row-text"><b>{s.name}</b><span>{U.n(count(s.fixed ? "" : s.name), "item")}{s.fixed ? " · cannot be removed" : s.created ? " · created " + U.date(s.created) : ""}</span></div>
            <A.Button size="sm" variant="ghost" onClick={() => { store.savePrefs({ space: s.fixed ? "" : s.name }); ui.go({ view: "vault", filter: "all" }); }}>Open</A.Button>
            {!s.fixed && <A.Menu align="end" width={200} trigger={<A.IconButton icon="ellipsis" label={"More for " + s.name} tip={false} />} items={[
              { label: "Rename", icon: "pencil", onSelect: () => ui.open("space-rename", { id: s.id }) },
              { separator: true },
              { label: "Delete space", icon: "trash-2", danger: true, onSelect: () => ui.open("space-delete", { id: s.id }) }
            ]} />}
          </div>
        ))}
      </Card>
      <p className="help">Spaces sync as part of the vault. You can leave a space out of a provider with <span className="mono-inline">.apmignore</span> in Sync.</p>
    </>
  );
}

function ColorPick({ value, onChange, disabled }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => { if (!open) return; const d = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", d); return () => document.removeEventListener("mousedown", d); }, [open]);
  return (
    <span className="cpick" ref={ref}>
      <button type="button" className="cpick-btn" disabled={disabled} aria-label="Space color" onClick={() => setOpen(!open)}><SpaceDot color={value} size={10} /></button>
      {open && <div className="cpick-pop">{SPACE_COLORS.slice(0, 7).map((c, i) => <button key={c} type="button" className={cx("cpick-sw", value === i && "is-on")} style={{ background: c }} aria-label={"Color " + (i + 1)} onClick={() => { onChange(i); setOpen(false); }} />)}</div>}
    </span>
  );
}

const ALERT_EVENTS = [
  { level: 1, action: "UNLOCK_FAILED", label: "Failed unlock attempts" },
  { level: 1, action: "ANOMALY", label: "Unusual activity" },
  { level: 1, action: "VAULT_DESTROYED", label: "Vault destroyed" },
  { level: 1, action: "RECOVERY_COMPLETED", label: "Password reset with recovery" },
  { level: 2, action: "MASTER_PASSWORD_CHANGED", label: "Master password changed" },
  { level: 2, action: "PROFILE_CHANGED", label: "Encryption profile changed" },
  { level: 2, action: "SETTINGS_CHANGED", label: "Security settings changed" },
  { level: 2, action: "MCP_TOKEN_CREATED", label: "AI token created" },
  { level: 3, action: "VAULT_UNLOCKED", label: "Every unlock" },
  { level: 3, action: "DATA_EXPORTED", label: "Exports" },
  { level: 3, action: "CLOUD_SYNC_SUCCESS", label: "Syncs" }
];

export function Alerts() {
  const disk = useStore((s) => s.disk);
  const m = disk.meta;
  const [email, setEmail] = React.useState(m.alertEmail || "");
  const lvl = m.securityLevel || 1;
  const recent = disk.audit.filter((e) => ALERT_EVENTS.some((x) => x.action === e.action && x.level <= lvl)).slice(0, 8);
  return (
    <>
      <Head title="Alerts" cli="pm auth alerts" description="Get an email when something important happens to this vault. Alerts are sent from this Mac, only while the app or pm is running." />
      <Card flush>
        <A.SettingRow icon="bell" title="Security alerts" description={m.alerts ? "On. Adds 10 points to your vault health." : "Off. Turning this on adds 10 points to vault health."}><A.Switch label="Security alerts" checked={!!m.alerts} onChange={(v) => { if (v && !m.alertEmail && !email) { ui.toast({ title: "Add an email below first", tone: "neutral", icon: "mail" }); return; } act.meta(v && !m.alertEmail ? { alerts: true, alertEmail: email } : { alerts: v }); }} /></A.SettingRow>
        <A.SettingRow icon="radar" title="Anomaly detection" description="Flags unlocks at unusual hours and bursts of failed attempts, even with email alerts off."><A.Switch label="Anomaly detection" checked={!!m.anomaly} onChange={(v) => act.meta({ anomaly: v })} /></A.SettingRow>
      </Card>
      <Card title="Where alerts go" description="Only the last four characters of this address are stored in logs."
        footer={<A.Button size="sm" variant="primary" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email === m.alertEmail} onClick={async () => { const r = await act.meta({ alertEmail: email }); if (r.ok) ui.toast({ title: "Alerts will go to " + email }); }}>Save</A.Button>}>
        <A.Input label="Email" type="email" icon="mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Card>
      <Card title="What to send" cli={"pm auth level " + lvl}>
        <div className="levels">
          {[[1, "Critical only", "Failed unlocks, anomalies, recovery and destroy."], [2, "Security changes", "Critical, plus password, profile, token and policy changes."], [3, "Everything", "Every unlock, export and sync. Noisy."]].map(([v, t, d]) => (
            <button key={v} type="button" className={cx("level", lvl === v && "is-on")} disabled={!m.alerts} onClick={() => act.meta({ securityLevel: v })} aria-pressed={lvl === v ? "true" : "false"}>
              <span className="level-top"><span className="level-n">Level {v}</span>{lvl === v && <A.Icon name="check" size={14} strokeWidth={2.5} />}</span>
              <b>{t}</b><span>{d}</span>
            </button>
          ))}
        </div>
        <div className="alert-events">{ALERT_EVENTS.map((x) => <span key={x.action} className={cx("alert-ev", x.level <= lvl && m.alerts && "is-on")}><A.Icon name={x.level <= lvl && m.alerts ? "check" : "minus"} size={12} strokeWidth={2.25} />{x.label}</span>)}</div>
      </Card>
      <Card title="Recent alertable events" flush>
        {recent.length === 0 ? <div className="apm-card-empty">Nothing at this level yet.</div> : recent.map((e) => (
          <div key={e.id} className="mini-event">
            <span className={cx("mini-event-dot", /FAILED|ANOMALY|DESTROYED/.test(e.action) && "is-danger")} />
            <span className="mono-small">{e.action}</span>
            <span className="muted grow ellipsis">{e.details}</span>
            <span className="muted small">{U.ago(e.ts)}</span>
            <span className="small">{m.alerts ? "Emailed" : "Logged"}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

export function About() {
  const info = useStore((s) => s.info) || {};
  return (
    <>
      <div className="about-hero">
        <A.Mark size={64} tile />
        <div className="stack-4"><h1 className="title-1 about-title">APM</h1><span className="muted">A local-first password and secrets manager for people who live in the terminal.</span></div>
      </div>
      <Card flush>
        <A.SettingRow title="Version"><span className="mono">{info.version || "unknown"}</span></A.SettingRow>
        <A.SettingRow title="Vault format" description="APMVAULT header, v4 payload"><span className="mono">v4</span></A.SettingRow>
        <A.SettingRow title="License"><span>MIT</span></A.SettingRow>
        <A.SettingRow title="Source"><A.Button size="sm" variant="ghost" iconRight="arrow-up-right" onClick={() => openUrl("https://github.com/aaravmaloo/apm")}>github.com/aaravmaloo/apm</A.Button></A.SettingRow>
        <A.SettingRow title="Documentation"><A.Button size="sm" variant="ghost" iconRight="arrow-up-right" onClick={() => openUrl("https://aaravmaloo.github.io/apm")}>aaravmaloo.github.io/apm</A.Button></A.SettingRow>
        <A.SettingRow title="Keyboard shortcuts"><A.Button size="sm" icon="keyboard" kbd={["⌘", "/"]} onClick={() => ui.open("shortcuts")}>Show</A.Button></A.SettingRow>
      </Card>
    </>
  );
}
