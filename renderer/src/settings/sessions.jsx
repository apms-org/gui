import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { Card, Head, Status, useNow, left } from "./common.jsx";
import { CodeBlock } from "../ui/kit.jsx";

const cx = U.cx;
const TTL = [{ value: "15", label: "15 minutes" }, { value: "60", label: "1 hour" }, { value: "240", label: "4 hours" }, { value: "1440", label: "24 hours" }];

export function Sessions() {
  const disk = useStore((s) => s.disk);
  const s = useStore((x) => x.session);
  const now = useNow(1000);
  const st = disk.settings;
  const idleAt = s.lastActive + Number(st.inactivity) * 60000;
  const maxAt = s.unlockedAt + Number(st.sessionTimeout) * 60000;
  const lockAt = Math.min(idleAt, maxAt);
  const total = Math.min(Number(st.inactivity), Number(st.sessionTimeout)) * 60000;
  const live = disk.sessions.filter((x) => !x.revoked && x.expires > now);
  const dead = disk.sessions.filter((x) => x.revoked || x.expires <= now);
  const revoke = async (x) => { const r = await act.sessionRevoke(x.id); if (r.ok) ui.toast({ title: "Revoked “" + (x.label || x.id) + "”", tone: "neutral" }); };
  const cli = disk.cliSession || {};
  return (
    <>
      <Head title="Sessions" description="How long this unlock lasts, and short-lived sessions you hand to scripts, CI and agents." cli="pm session list" />
      <Card title="This session" cli={s.readonly ? "pm readonly" : "pm lock"}
        footer={<>{s.readonly ? <A.Button size="sm" onClick={async () => { const r = await act.endReadonly(); if (r.ok) ui.toast({ title: "Editing is back on" }); }}>End read-only</A.Button> : <A.Menu align="end" width={200} trigger={<A.Button size="sm" icon="eye" iconRight="chevron-down">Read-only</A.Button>} items={[{ section: "Stay read-only for" }].concat([15, 30, 60, 240].map((m) => ({ label: m < 60 ? m + " minutes" : m / 60 + " hour" + (m === 60 ? "" : "s"), onSelect: async () => { const r = await act.readonly(m); if (r.ok) ui.toast({ title: "Read-only for " + (m < 60 ? m + " minutes" : m / 60 + "h"), description: "Nothing can be added, edited or deleted.", icon: "eye" }); } })))} />}<A.Button size="sm" variant="primary" icon="lock" kbd={["⌘", "L"]} onClick={() => act.lock("manual")}>Lock now</A.Button></>}>
        <div className="session-now">
          <div className="session-ring">
            <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" className="ring-track" /><circle cx="22" cy="22" r="19" className="ring-arc" strokeDasharray={119.4} strokeDashoffset={119.4 * (1 - Math.max(0, (lockAt - now) / total))} /></svg>
            <A.Icon name={s.readonly ? "eye" : "lock-open"} size={16} />
          </div>
          <div className="session-facts">
            <div><span className="muted small">Unlocked</span><b>{U.agoLong(s.unlockedAt)}</b></div>
            <div><span className="muted small">Locks in</span><b className="mono">{left(lockAt - now).replace(" left", "")}</b></div>
            <div><span className="muted small">Mode</span><b>{s.readonly ? (s.readonlyUntil ? "Read-only until " + new Date(s.readonlyUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Read-only") : "Full access"}</b></div>
          </div>
        </div>
      </Card>
      <Card title="Terminal session" description="Unlocking here also unlocks pm in your terminal, and locking here locks it. Both use the same encrypted session file." flush cli="pm unlock">
        <A.SettingRow icon="terminal" title={cli.active ? "pm is unlocked" : "pm is locked"} description={cli.active ? (cli.expires ? "Until " + new Date(cli.expires).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Active") + (cli.inactivity ? ", or after " + Math.round(cli.inactivity / 60000) + " minutes idle" : "") + (cli.readonly ? " · read-only" : "") : "pm asks for your master password the next time you run it."}>
          {cli.active ? <Status tone="success">Active</Status> : <Status tone="neutral">Locked</Status>}
        </A.SettingRow>
      </Card>
      <Card title="Ephemeral sessions" description="A scoped, expiring unlock for a process that should never see your master password. Revoke one and it stops working immediately."
        actions={<A.Button size="sm" variant="primary" icon="plus" onClick={() => ui.open("session-issue")}>Issue session</A.Button>} flush cli="pm session issue">
        {live.length === 0 && <div className="card-empty">No active sessions.</div>}
        {live.map((x) => <SessionRow key={x.id} x={x} now={now} onRevoke={() => revoke(x)} />)}
        {dead.length > 0 && <div className="card-sub">Expired and revoked</div>}
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
          {err && <div className="apm-hint apm-hint-danger apm-hint-enter" role="alert"><A.Icon name="triangle-alert" size={14} />{err}</div>}
        </div>
      ) : (
        <div className="stack-12">
          <CodeBlock label="Environment" copy={env} wrap>{env}</CodeBlock>
          <CodeBlock label="Use it" copy={env + " pm get \"Item name\""} wrap>{env + " pm get \"Item name\""}</CodeBlock>
        </div>
      )}
    </A.Dialog>
  );
}

register("session-issue", IssueDialog);
