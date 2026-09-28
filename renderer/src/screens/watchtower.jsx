import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { getType, titleOf, passwordKey } from "../lib/types.js";
import { ui } from "../lib/ui.js";
import { LEVEL_TONE, LEVEL_LABEL } from "../lib/health.js";
import { register } from "../lib/registry.js";
import { Meter, Cli } from "../ui/kit.jsx";

const cx = U.cx;
const KINDS = [
  { value: "all", label: "All issues" },
  { value: "weak", label: "Weak", icon: "shield-off" },
  { value: "reused", label: "Reused", icon: "copy" },
  { value: "old", label: "Old", icon: "clock" },
  { value: "exposed", label: "Exposed", icon: "triangle-alert" },
  { value: "expiring", label: "Expiring", icon: "calendar" },
  { value: "trust", label: "Trust scores", icon: "gauge" }
];

export function Watchtower({ analysis: a }) {
  const disk = useStore((s) => s.disk);
  const [tab, setTab] = React.useState("all");
  const tone = a.score >= 80 ? "success" : a.score >= 50 ? "warning" : "danger";
  const verdict = a.score >= 80 ? "In good shape" : a.score >= 50 ? "Needs attention" : "At risk";
  const count = (k) => a.issues.filter((x) => x.kind === k).length;
  const issues = tab === "all" ? a.issues : a.issues.filter((x) => x.kind === tab);
  const open = (it, edit) => { ui.go({ view: "vault", filter: "all" }); ui.select(it.id); if (edit) ui.edit(it.id); };
  return (
    <div className="page">
      <div className="page-bar drag" />
      <div className="page-inner" style={{ maxWidth: 900 }}>
        <header className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">Watchtower</h1>
            <p className="page-desc">Checks run locally against your decrypted vault. Nothing is sent anywhere.</p>
            <div className="set-cli"><Cli cmd="pm health" /><Cli cmd="pm trust" /></div>
          </div>
          <div className="page-actions">
            <A.Button size="sm" icon="eraser" onClick={() => ui.open("cleanup")}>Clean up</A.Button>
          </div>
        </header>
        <div className="wt-hero">
          <Meter value={a.score} tone={tone} size={132} stroke={10} sub="of 100" />
          <div className="wt-hero-text">
            <div className="wt-verdict"><A.Badge tone={tone} dot>{verdict}</A.Badge></div>
            <h2 className="title-2">Vault health</h2>
            <div className="wt-lines">
              {a.lines.map((l) => <div key={l.text} className="wt-line"><span className={"wt-dot is-" + l.tone} /><span>{l.text}{l.note ? <span className="muted"> · {l.note}</span> : null}</span><span className={cx("mono-small", l.delta > 0 && "pos", l.delta < 0 && "neg")}>{l.delta > 0 ? "+" + l.delta : l.delta === 0 ? "0" : l.delta}</span></div>)}
            </div>
          </div>
        </div>
        <div className="wt-tiles">
          {KINDS.slice(1, 6).map((k) => { const n = count(k.value); return (
            <button key={k.value} type="button" className={cx("wt-tile", tab === k.value && "is-on", n > 0 && "has")} onClick={() => setTab(tab === k.value ? "all" : k.value)}>
              <span className="wt-tile-top"><A.Icon name={k.icon} size={14} />{k.label}</span>
              <b>{n}</b>
            </button>
          ); })}
        </div>
        <A.Tabs label="Issues" items={KINDS.map((k) => ({ value: k.value, label: k.label, count: k.value === "trust" ? undefined : k.value === "all" ? a.issues.length : count(k.value) }))} value={tab} onChange={setTab} />
        {tab === "trust" ? <TrustTable a={a} /> : issues.length === 0 ? (
          <A.EmptyState icon="shield-check" title={tab === "all" ? "Nothing to fix" : "No " + KINDS.find((k) => k.value === tab).label.toLowerCase() + " items"}>{tab === "reused" ? "Every password in this vault is unique." : "Watchtower rechecks every time the vault changes."}</A.EmptyState>
        ) : (
          <div className="issues">
            {issues.map((x) => (
              <div key={x.id} className="issue">
                <A.ItemIcon name={titleOf(x.item)} size="md" icon={x.item.type === "password" ? undefined : getType(x.item.type).icon} />
                <div className="issue-text">
                  <div className="issue-top"><b>{titleOf(x.item)}</b><A.Badge size="sm" tone={x.tone}>{x.title}</A.Badge></div>
                  <span>{x.body}</span>
                </div>
                <div className="issue-actions">
                  {passwordKey(x.item.type) && ["weak", "reused", "old"].includes(x.kind) && <A.Button size="sm" onClick={() => open(x.item, true)}>Change password</A.Button>}
                  {x.kind === "exposed" && <A.Button size="sm" onClick={() => act.patchMeta(x.item.id, { exposed: false })}>Clear flag</A.Button>}
                  <A.IconButton icon="arrow-up-right" label="Open item" onClick={() => open(x.item)} />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="help wt-foot"><A.Icon name="info" size={13} />The first lines match <code className="mono-inline">pm health</code>: profile, alerts, short passwords and trust scores. App checks for guessable, reused, old, exposed and expiring secrets also count. APM does not check breach databases.</p>
      </div>
    </div>
  );
}

function TrustTable({ a }) {
  const rows = a.trust.slice().sort((x, y) => x.score - y.score);
  return (
    <div className="trust-table" role="table" aria-label="Trust scores">
      <div className="trust-row is-head" role="row"><span>Item</span><span>Score</span><span>Risk</span><span>Why</span></div>
      {rows.map((r) => (
        <button type="button" key={r.item.id} className="trust-row" role="row" onClick={() => { ui.go({ view: "vault", filter: "all" }); ui.select(r.item.id); }}>
          <span className="trust-item"><A.ItemIcon name={titleOf(r.item)} size="sm" icon={r.item.type === "password" ? undefined : getType(r.item.type).icon} /><b>{titleOf(r.item)}</b></span>
          <span className="trust-score"><span className="mono">{r.score}</span><A.Progress value={r.score} tone={LEVEL_TONE[r.level] === "accent" ? undefined : LEVEL_TONE[r.level]} /></span>
          <span><A.Badge size="sm" tone={LEVEL_TONE[r.level]}>{LEVEL_LABEL[r.level]}</A.Badge></span>
          <span className="trust-why">{r.reasons.length ? r.reasons.map((x) => x.text).join(" · ") : "No risk factors"}</span>
        </button>
      ))}
    </div>
  );
}

function CleanupDialog({ onClose }) {
  const [scan, setScan] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  React.useEffect(() => { let live = true; act.cleanupScan().then((r) => { if (!live) return; if (r.ok) setScan(r.issues || []); else setErr(r.error); }); return () => { live = false; }; }, []);
  const list = scan || [];
  const fixable = list.filter((x) => x.fix);
  const report = list.filter((x) => !x.fix);
  const fix = async () => { setBusy(true); const r = await act.cleanupApply(fixable.map((x) => x.id)); setBusy(false); if (r.ok) { setDone(true); ui.toast({ title: "Fixed " + (r.fixed != null ? r.fixed : fixable.length) + " issue" + (fixable.length === 1 ? "" : "s") }); } };
  return (
    <A.Dialog open onClose={onClose} size="md" icon="eraser" title="Clean up the vault" description="Looks for empty names, broken authenticators, orphaned spaces and deprecated fields. Same checks as pm cleanup."
      footer={<><A.Button onClick={onClose}>Close</A.Button>{fixable.length > 0 && !done && <A.Button variant="primary" loading={busy} onClick={fix}>Fix {fixable.length} issue{fixable.length === 1 ? "" : "s"}</A.Button>}</>}>
      {scan == null && !err && <div className="touch-wait"><A.Spinner size={16} /><span>Scanning…</span></div>}
      {err && <A.Callout tone="danger" title="Scan failed">{err}</A.Callout>}
      {scan && (list.length === 0 ? <A.Callout tone="success" title="Nothing to clean up">No empty names, broken authenticators, missing spaces or deprecated fields.</A.Callout> : <>
        {fixable.length > 0 && <div className="stack-8"><span className="apm-label">Can be fixed automatically</span><div className="mini-list">{fixable.map((x) => <div key={x.id} className="mini-row"><A.Icon name={done ? "circle-check" : "sparkles"} size={14} /><span>{x.title}</span><span className="muted">{x.detail}</span></div>)}</div></div>}
        {report.length > 0 && <div className="stack-8"><span className="apm-label">Needs a decision from you</span><div className="mini-list">{report.map((x) => <div key={x.id} className="mini-row"><A.Icon name="info" size={14} /><span>{x.title}</span><span className="muted">{x.detail}</span></div>)}</div></div>}
      </>)}
    </A.Dialog>
  );
}
register("cleanup", CleanupDialog);
