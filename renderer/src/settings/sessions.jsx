import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { Card, Head, useNow, left, lockMinutes, lockLabel, lockOptions } from "./common.jsx";

const cx = U.cx;
const TTL = [{ value: "15", label: "15 minutes" }, { value: "60", label: "1 hour" }, { value: "240", label: "4 hours" }, { value: "1440", label: "24 hours" }];
const IDLE = [1, 5, 15, 30, 60, 240, 0];
const MAX = [15, 60, 240, 480, 1440, 0];
const NEVER = {
  inactivity: { title: "Never lock when idle?", description: "The vault stays unlocked while you are away from this Mac, until the maximum session ends, the Mac sleeps or you lock it. This applies to the app, pm and the browser extension.", confirm: "Never lock when idle" },
  sessionTimeout: { title: "Remove the session limit?", description: "As long as you keep using it, the vault never asks for your master password again. Only inactivity, sleep or locking it yourself ends the session. This applies to the app, pm and the browser extension.", confirm: "Remove the limit" }
};
const until = (ts) => { const d = new Date(ts); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }); };

function AutoLock() {
  const disk = useStore((s) => s.disk);
  const st = disk.settings;
  const idle = lockMinutes(st.inactivity);
  const max = lockMinutes(st.sessionTimeout);
  const pick = (key, v) => {
    if (v !== "0" || lockMinutes(st[key]) === 0) { act.settings({ [key]: v }); return; }
    ui.open("confirm", Object.assign({ icon: "triangle-alert", tone: "warning", onConfirm: () => act.settings({ [key]: v }) }, NEVER[key]));
  };
  const warn = !idle && !max ? (st.lockOnSleep ? ["APM only locks when the Mac sleeps", "Until then the vault stays unlocked, even while you are away. Anyone who uses this Mac can read every secret in the app, in pm and in the browser."] : ["APM never locks on its own", "The vault stays unlocked until you lock it or quit APM. Anyone who uses this Mac in the meantime can read every secret in the app, in pm and in the browser."])
    : !idle ? ["APM doesn't lock when you step away", "The vault stays unlocked for up to " + lockLabel(max) + " after you unlock it, even while you are away. Lock it with ⌘L before you leave this Mac."]
    : !max ? ["Sessions have no time limit", "While you keep using it, the vault never asks for your master password again. It still locks after " + lockLabel(idle) + " idle" + (st.lockOnSleep ? " and when the Mac sleeps." : ".")]
    : null;
  return (
    <Card title="Auto-lock" description="When the vault locks itself. Applies to this app, pm in your terminal and the browser extension. Locking wipes the key from memory." flush cli="pm autolock">
      <A.SettingRow title="Lock after inactivity" description="No keyboard, pointer or browser activity for this long." htmlFor="idle"><A.Select id="idle" size="sm" value={String(idle)} onChange={(v) => pick("inactivity", v)} options={lockOptions(IDLE, st.inactivity)} disabled={disk.readonly} /></A.SettingRow>
      <A.SettingRow title="Maximum session" description="Locks even while you are using it, then asks for your password again." htmlFor="max"><A.Select id="max" size="sm" value={String(max)} onChange={(v) => pick("sessionTimeout", v)} options={lockOptions(MAX, st.sessionTimeout)} disabled={disk.readonly} /></A.SettingRow>
      <A.SettingRow title="Lock when the Mac sleeps" description="Also when the screen locks or the lid closes."><A.Switch label="Lock on sleep" checked={!!st.lockOnSleep} onChange={(v) => act.settings({ lockOnSleep: v })} disabled={disk.readonly} /></A.SettingRow>
      {warn && <div className="apm-card-pad"><A.Callout tone="warning" icon="triangle-alert" title={warn[0]}>{warn[1]}</A.Callout></div>}
    </Card>
  );
}

export function Sessions() {
  const disk = useStore((s) => s.disk);
  const s = useStore((x) => x.session);
  const now = useNow(1000);
  const st = disk.settings;
  const idle = lockMinutes(st.inactivity);
  const max = lockMinutes(st.sessionTimeout);
  const ends = [idle && s.lastActive + idle * 60000, max && s.unlockedAt + max * 60000].filter(Boolean);
  const lockAt = ends.length ? Math.min.apply(null, ends) : 0;
  const total = Math.min.apply(null, [idle, max].filter(Boolean).concat([Infinity])) * 60000;
  const frac = lockAt ? Math.max(0, Math.min(1, (lockAt - now) / total)) : 1;
  const live = disk.sessions.filter((x) => !x.revoked && x.expires > now);
  const dead = disk.sessions.filter((x) => x.revoked || x.expires <= now);
  const revoke = async (x) => { const r = await act.sessionRevoke(x.id); if (r.ok) ui.toast({ title: "Revoked “" + (x.label || x.id) + "”", tone: "neutral" }); };
  const cli = disk.cliSession || {};
  return (
    <>
      <Head title="Sessions" description="When the vault locks itself, how long this unlock lasts, and short-lived sessions you hand to scripts, CI and agents." cli="pm session list" />
      <AutoLock />
      <Card title="This session" cli={s.readonly ? "pm readonly" : "pm lock"}
        footer={<>{disk.newerFormat ? null : s.readonly ? <A.Button size="sm" onClick={async () => { const r = await act.endReadonly(); if (r.ok) ui.toast({ title: "Editing is back on" }); }}>End read-only</A.Button> : <A.Menu align="end" width={200} trigger={<A.Button size="sm" icon="eye" iconRight="chevron-down">Read-only</A.Button>} items={[{ section: "Stay read-only for" }].concat([15, 30, 60, 240].map((m) => ({ label: m < 60 ? m + " minutes" : m / 60 + " hour" + (m === 60 ? "" : "s"), onSelect: async () => { const r = await act.readonly(m); if (r.ok) ui.toast({ title: "Read-only for " + (m < 60 ? m + " minutes" : m / 60 + "h"), description: "Nothing can be added, edited or deleted.", icon: "eye" }); } })))} />}<A.Button size="sm" variant="primary" icon="lock" kbd={["⌘", "L"]} onClick={() => act.lock("manual")}>Lock now</A.Button></>}>
        <div className="session-now">
          <div className="session-ring">
            <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" className="ring-track" /><circle cx="22" cy="22" r="19" className="ring-arc" strokeDasharray={119.4} strokeDashoffset={119.4 * (1 - frac)} /></svg>
            <A.Icon name={s.readonly ? "eye" : "lock-open"} size={16} />
          </div>
          <div className="session-facts">
            <div><span className="muted small">Unlocked</span><b>{U.agoLong(s.unlockedAt)}</b></div>
            <div><span className="muted small">Locks in</span><b className={lockAt ? "mono" : undefined}>{lockAt ? left(lockAt - now).replace(" left", "") : st.lockOnSleep ? "On sleep" : "Never"}</b></div>
            <div><span className="muted small">Mode</span><b>{disk.newerFormat ? "Read-only, newer vault format" : s.readonly ? (s.readonlyUntil ? "Read-only until " + new Date(s.readonlyUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Read-only") : "Full access"}</b></div>
          </div>
        </div>
      </Card>
      <Card title="Terminal session" description="Unlocking here also unlocks pm in your terminal, and locking here locks it. Both use the same encrypted session file." flush cli="pm unlock">
        <A.SettingRow icon="terminal" title={cli.active ? "pm is unlocked" : "pm is locked"} description={cli.active ? (cli.expires ? "Until " + until(cli.expires) : "No time limit") + (cli.inactivity ? ", or after " + Math.round(cli.inactivity / 60000) + " minutes idle" : "") + (cli.readonly ? " · read-only" : "") : "pm asks for your master password the next time you run it."}>
          {cli.active ? <A.Status tone="success">Active</A.Status> : <A.Status tone="neutral">Locked</A.Status>}
        </A.SettingRow>
      </Card>
      <Card title="Ephemeral sessions" description="A scoped, expiring unlock for a process that should never see your master password. Revoke one and it stops working immediately."
        actions={<A.Button size="sm" variant="primary" icon="plus" onClick={() => ui.open("session-issue")}>Issue session</A.Button>} flush cli="pm session issue">
        {live.length === 0 && <div className="apm-card-empty">No active sessions.</div>}
        {live.map((x) => <SessionRow key={x.id} x={x} now={now} onRevoke={() => revoke(x)} />)}
        {dead.length > 0 && <div className="apm-card-label">Expired and revoked</div>}
        {dead.slice(0, 5).map((x) => <SessionRow key={x.id} x={x} now={now} dead />)}
      </Card>
    </>
  );
}

function SessionRow({ x, now, dead, onRevoke }) {
  const pct = Math.max(0, Math.min(1, (x.expires - now) / (x.expires - x.created)));
  return (
    <div className={cx("sess", dead && "is-dead")}>
      <span className="sess-icon"><A.Icon name={x.agent === "claude" ? "bot" : x.agent === "github-actions" ? "workflow" : "terminal"} size={15} /></span>
      <div className="sess-text">
        <div className="sess-top"><b>{x.label || "Untitled session"}</b><A.Badge size="sm" outline>{x.scope}</A.Badge>{x.bindHost && <A.Badge size="sm">host-bound</A.Badge>}{x.bindPid ? <A.Badge size="sm">pid-bound</A.Badge> : null}</div>
        <span className="mono-small muted">{x.id}{x.agent ? " · " + x.agent : ""} · issued {U.ago(x.created)}</span>
      </div>
      {dead ? <span className="muted small">{x.revoked ? "Revoked" : "Expired " + U.ago(x.expires)}</span> : (
        <>
          <div className="sess-ttl"><span className="mono-small">{left(x.expires - now)}</span><A.Progress value={pct * 100} tone={pct < 0.2 ? "warning" : undefined} /></div>
          <A.Button size="sm" variant="ghost" onClick={onRevoke}>Revoke</A.Button>
        </>
      )}
    </div>
  );
}

function IssueDialog({ onClose }) {
  const [label, setLabel] = React.useState("");
  const [agent, setAgent] = React.useState("");
  const [scope, setScope] = React.useState("read");
  const [ttl, setTtl] = React.useState("60");
  const [host, setHost] = React.useState(true);
  const [out, setOut] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const issue = async () => {
    setBusy(true); setErr(null);
    const r = await act.sessionIssue({ label: label.trim(), agent: agent.trim(), scope, minutes: Number(ttl), bindHost: host, bindPid: false });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    const sess = r.session || {};
    setOut({ id: r.id || sess.id, expires: sess.expires || Date.now() + Number(ttl) * 60000, agent: agent.trim() });
  };
  const env = out ? "APM_EPHEMERAL_ID=" + out.id + (out.agent ? " APM_EPHEMERAL_AGENT=" + out.agent : "") : "";
  return (
    <A.Dialog open onClose={onClose} size="md" icon="clock" title={out ? "Session issued" : "Issue an ephemeral session"} description={out ? "Hand these variables to the process. The session works until " + new Date(out.expires).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " or until you revoke it." : "The process gets a session ID instead of your master password."}
      footer={out ? <A.Button variant="primary" onClick={onClose}>Done</A.Button> : <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={!label.trim()} onClick={issue}>Issue session</A.Button></>}>
      {!out ? (
        <div className="stack-16">
          <A.Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="CI deploy" autoFocus />
          <div className="grid-2">
            <A.Input label="Agent name" value={agent} onChange={(e) => setAgent(e.target.value.replace(/\s/g, "-"))} placeholder="Optional, like github-actions" hint="If set, the process must also send it." />
            <A.Select label="Expires after" value={ttl} onChange={setTtl} options={TTL} />
          </div>
          <div className="stack-6"><span className="apm-label">Access</span><A.SegmentedControl label="Access" value={scope} onChange={setScope} options={[{ value: "read", label: "Read only" }, { value: "write", label: "Read and write" }]} /></div>
          <A.Checkbox checked={host} onChange={setHost} label="Bind to this Mac" description="The session fails on any other machine." />
          {err && <A.Hint tone="danger" icon="triangle-alert">{err}</A.Hint>}
        </div>
      ) : (
        <div className="stack-12">
          <A.CodeBlock label="Environment" copy={env} wrap>{env}</A.CodeBlock>
          <A.CodeBlock label="Use it" copy={env + " pm get \"Item name\""} wrap>{env + " pm get \"Item name\""}</A.CodeBlock>
        </div>
      )}
    </A.Dialog>
  );
}

register("session-issue", IssueDialog);
