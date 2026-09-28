import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { getType, TYPES } from "../lib/types.js";

const TYPE_IDS = new Set(TYPES.map((t) => t.id));
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { Cli } from "../ui/kit.jsx";
import { undoLast } from "./shell.jsx";

const cx = U.cx;
const ACTION_TONE = { SAVE: "neutral", UNDO: "accent", CHECKOUT: "accent", SQUASH: "warning", INIT: "success" };
const AUDIT_GROUPS = [
  { value: "all", label: "All" },
  { value: "access", label: "Unlocks", test: (a) => /UNLOCK|LOCK|ANOMALY|READONLY|SESSION|EPHEMERAL/.test(a) },
  { value: "changes", label: "Changes", test: (a) => /SAVED|LGIT|PROFILE|SETTINGS|IMPORT|EXPORT|CLEANUP|PASSWORD|POLICY|INJECT/.test(a) },
  { value: "sync", label: "Sync", test: (a) => /CLOUD/.test(a) },
  { value: "ai", label: "AI", test: (a) => /MCP/.test(a) },
  { value: "recovery", label: "Recovery", test: (a) => /RECOVERY|TOUCHID|MASTER|PASSKEY|BRIDGE/.test(a) }
];

export function History() {
  const disk = useStore((s) => s.disk);
  const [tab, setTab] = React.useState("versions");
  const [verify, setVerify] = React.useState(null);
  const head = disk.commits[0];
  const withSnap = disk.commits.filter((c) => c.snapshot);
  const snapBytes = withSnap.reduce((n, c) => n + (c.bytes || 0), 0);
  const runVerify = async () => { setVerify("running"); const r = await act.verify(); setVerify(r.ok ? r : { ok: false, good: 0, total: disk.commits.length }); };
  const undo = () => ui.open("confirm", { title: "Undo the last change?", description: "Restores the vault to the version before your most recent change. An UNDO commit is recorded, so you can redo it by restoring.", icon: "undo-2", confirm: "Undo", onConfirm: undoLast });
  const reset = () => ui.open("confirm", { title: "Reset to HEAD?", description: "Restores the latest snapshot over the current vault file. A CHECKOUT commit is recorded.", icon: "rotate-ccw", tone: "warning", confirm: "Reset to HEAD", onConfirm: async () => { const r = await act.checkout(head.id); ui.toast(r.ok ? { title: "Reset to HEAD" } : { title: r.error, tone: "danger" }); } });
  const prune = () => ui.open("confirm", { title: "Prune snapshots?", description: "Deletes snapshot files that no commit points to. Frees disk space. Commits are not affected.", icon: "eraser", confirm: "Prune", onConfirm: async () => { const r = await act.prune(); if (r.ok) ui.toast({ title: "Pruned " + (r.removed || 0) + " snapshot" + (r.removed === 1 ? "" : "s"), description: r.kept != null ? r.kept + " kept" : null }); } });
  return (
    <div className="page">
      <div className="page-bar drag" />
      <div className="page-inner" style={{ maxWidth: 900 }}>
        <header className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">History</h1>
            <p className="page-desc">Every save is a signed commit with an encrypted snapshot of the whole vault, so any change can be undone.</p>
            <div className="set-cli"><Cli cmd="pm lgit log" /><Cli cmd="pm lgit undo" /></div>
          </div>
          <div className="page-actions">
            <A.Button size="sm" icon="undo-2" kbd={["⌘", "Z"]} onClick={undo} disabled={disk.commits.length < 2 || disk.readonly}>Undo last change</A.Button>
            <A.Menu align="end" width={220} trigger={<A.IconButton icon="ellipsis" label="More history actions" tip={false} variant="secondary" size="md" />} items={[
              { label: "Reset to HEAD", icon: "rotate-ccw", onSelect: reset },
              { label: "Squash history…", icon: "archive", onSelect: () => ui.open("squash") },
              { label: "Prune snapshots", icon: "eraser", onSelect: prune }
            ]} />
          </div>
        </header>
        <div className="hist-status">
          <div className="hist-stat"><span className="hist-stat-l">HEAD</span><span className="hist-stat-v"><A.Badge tone={head ? "success" : "neutral"} dot>{head ? head.action : "No commits"}</A.Badge><span className="mono-small">{head ? head.id.slice(-12) : "none"}</span></span><span className="hist-stat-s">{head ? "Latest commit " + U.agoLong(head.ts) : "Saves from pm and the app record commits"}</span></div>
          <div className="hist-stat"><span className="hist-stat-l">Chain</span><span className="hist-stat-v">{verify && verify !== "running" ? <A.Badge tone={verify.ok ? "success" : "danger"} icon={verify.ok ? "check-check" : "triangle-alert"}>{verify.good} of {verify.total} verified</A.Badge> : <A.Button size="sm" variant="ghost" icon="shield-check" loading={verify === "running"} onClick={runVerify}>Verify signatures</A.Button>}</span><span className="hist-stat-s">HMAC-SHA256 over each commit and its parent</span></div>
          <div className="hist-stat"><span className="hist-stat-l">Snapshots</span><span className="hist-stat-v"><b>{withSnap.length}</b><span className="muted">· {U.bytes(snapBytes)}</span></span><span className="hist-stat-s">{withSnap.length} of {disk.commits.length} commits can be restored</span></div>
        </div>
        <A.Tabs label="History" items={[{ value: "versions", label: "Commits", count: disk.commits.length }, { value: "audit", label: "Audit log", count: disk.audit.length }, { value: "events", label: "Vault events", count: disk.history.length }]} value={tab} onChange={setTab} />
        {tab === "versions" && <Commits />}
        {tab === "audit" && <Audit />}
        {tab === "events" && <Events />}
      </div>
    </div>
  );
}

function Commits() {
  const disk = useStore((s) => s.disk);
  const [open, setOpen] = React.useState(null);
  return (
    <div className="timeline">
      {disk.commits.map((c, i) => {
        const has = !!c.snapshot;
        return (
          <div key={c.id} className={cx("commit", i === 0 && "is-head", open === c.id && "is-open")}>
            <span className="commit-rail" aria-hidden="true"><i /></span>
            <div className="commit-main">
              <button type="button" className="commit-row" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id ? "true" : "false"}>
                <A.Badge size="sm" tone={ACTION_TONE[c.action] || "neutral"}>{c.action}</A.Badge>
                <span className="commit-note">{c.note || "Saved"}</span>
                {i === 0 && <A.Badge size="sm" outline>HEAD</A.Badge>}
                <span className="grow" />
                <span className="mono-small muted">{c.id.slice(-12)}</span>
                <span className="commit-time">{U.ago(c.ts)}</span>
                <A.Icon name="check-check" size={13} className={c.verified ? "verified-ic" : "broken-ic"} />
              </button>
              {open === c.id && (
                <div className="commit-detail">
                  <div className="kv-list">
                    <div className="kv"><div className="kv-label">Commit</div><div className="kv-value is-mono">{c.id}</div></div>
                    <div className="kv"><div className="kv-label">Time</div><div className="kv-value">{U.dateTime(c.ts)}</div></div>
                    <div className="kv"><div className="kv-label">Data hash</div><div className="kv-value is-mono">{c.dataHash ? c.dataHash.slice(0, 32) + "…" : "none"}</div></div>
                    <div className="kv"><div className="kv-label">Parent hash</div><div className="kv-value is-mono">{c.prevHash ? c.prevHash.slice(0, 32) + "…" : "none (root)"}</div></div>
                    <div className="kv"><div className="kv-label">Snapshot</div><div className="kv-value is-mono">{has ? "lgit_snapshots · " + U.bytes(c.bytes || 0) : "missing"}</div></div>
                    <div className="kv"><div className="kv-label">Signature</div><div className="kv-value">{c.verified ? <A.Badge size="sm" tone="success" icon="check-check">Verified</A.Badge> : <A.Badge size="sm" tone="danger">Broken</A.Badge>}</div></div>
                  </div>
                  {i > 0 && <div className="commit-actions"><A.Button size="sm" icon="rotate-ccw" onClick={() => ui.open("confirm", { title: "Restore this version?", description: "The vault goes back to how it was on " + U.dateTime(c.ts) + ". A CHECKOUT commit is recorded, so this is undoable. The snapshot must decrypt with your current master password.", icon: "rotate-ccw", confirm: "Restore version", onConfirm: async () => { const r = await act.checkout(c.id); ui.toast(r.ok ? { title: "Vault restored to " + U.date(c.ts) } : { title: r.error, tone: "danger" }); } })} disabled={!has || disk.readonly}>Restore this version</A.Button>{!has && <span className="muted small">Snapshot was squashed. Only newer versions can be restored.</span>}</div>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Audit() {
  const disk = useStore((s) => s.disk);
  const [g, setG] = React.useState("all");
  const [q, setQ] = React.useState("");
  const G = AUDIT_GROUPS.find((x) => x.value === g);
  const rows = disk.audit.filter((e) => (!G.test || G.test(e.action)) && (!q || (e.action + " " + e.details + " " + e.who).toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="stack-12">
      <div className="audit-tools">
        <div className="chips">{AUDIT_GROUPS.map((x) => <button key={x.value} type="button" className={cx("chip", g === x.value && "is-on")} onClick={() => setG(x.value)}>{x.label}</button>)}</div>
        <A.SearchField size="sm" placeholder="Filter events" value={q} onChange={setQ} shortcut={null} />
      </div>
      <div className="audit">
        {rows.length === 0 && <A.EmptyState icon="activity" title="No events match">Try another filter.</A.EmptyState>}
        {rows.slice(0, 200).map((e) => (
          <div key={e.id} className={cx("audit-row", /FAILED|ANOMALY|DESTROYED|AUTH_FAILED/.test(e.action) && "is-alert")}>
            <span className="audit-time">{U.dateTime(e.ts)}</span>
            <span className="audit-action mono-small">{e.action}</span>
            <span className="audit-details">{e.details || <span className="muted">No details</span>}</span>
            <span className="audit-who mono-small">{e.who}</span>
            <A.Tooltip label={e.verified ? "Signature verified" : "Signature does not match"}><A.Icon name={e.verified ? "check-check" : "triangle-alert"} size={13} className={e.verified ? "verified-ic" : "broken-ic"} /></A.Tooltip>
          </div>
        ))}
      </div>
      <p className="help">Stored in <code className="mono-inline">audit.json</code> in the APM config folder, a hash-chained file signed with a key kept outside the vault. Shared with pm.</p>
    </div>
  );
}

function Events() {
  const disk = useStore((s) => s.disk);
  const [a, setA] = React.useState("all");
  const rows = disk.history.filter((e) => a === "all" || e.action === a);
  return (
    <div className="stack-12">
      <div className="chips">{["all", "ADD", "EDIT", "GET", "DEL", "MERGE"].map((x) => <button key={x} type="button" className={cx("chip", a === x && "is-on")} onClick={() => setA(x)}>{x === "all" ? "All" : x}</button>)}</div>
      <div className="audit">
        {rows.slice(0, 200).map((e, i) => (
          <div key={i} className="audit-row">
            <span className="audit-time">{U.dateTime(e.ts)}</span>
            <span><A.Badge size="sm" tone={e.action === "DEL" ? "danger" : e.action === "ADD" ? "success" : e.action === "MERGE" || e.action === "EDIT" ? "accent" : "neutral"}>{e.action}</A.Badge></span>
            <span className="audit-details">{e.identifier}</span>
            <span className="audit-who">{e.category === "space" ? "Space" : TYPE_IDS.has(e.category) ? getType(e.category).label : String(e.category || "").toLowerCase()}</span>
            <A.Icon name={e.verified === false ? "triangle-alert" : "check-check"} size={13} className={e.verified === false ? "broken-ic" : "verified-ic"} />
          </div>
        ))}
      </div>
      <p className="help">The in-vault history chain, written by the CLI and the app. It travels with the vault file.</p>
    </div>
  );
}

function SquashDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const [keep, setKeep] = React.useState(10);
  const drop = Math.max(0, disk.commits.length - keep);
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="archive" tone="warning" title="Squash history" description="Keeps the newest commits and deletes the rest with their snapshots. The remaining chain is re-linked and re-signed."
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" disabled={!drop} onClick={async () => { const r = await act.squash(keep); if (r.ok) ui.toast({ title: "History squashed", description: drop + " older commit" + (drop === 1 ? "" : "s") + " removed" }); onClose(); }}>Squash {drop} commit{drop === 1 ? "" : "s"}</A.Button></>}>
      <div className="slider-row"><label htmlFor="sq">Keep the last</label><A.Slider id="sq" label="Commits to keep" min={1} max={Math.max(2, Math.min(100, disk.commits.length))} value={keep} onChange={setKeep} /><span className="mono">{keep}</span></div>
      <p className="help">{disk.commits.length} commits now. You will not be able to restore anything older than {disk.commits[Math.min(keep, disk.commits.length) - 1] ? U.date(disk.commits[Math.min(keep, disk.commits.length) - 1].ts) : "today"}.</p>
    </A.Dialog>
  );
}
register("squash", SquashDialog);
