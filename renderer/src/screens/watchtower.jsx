import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { getType, titleOf } from "../lib/types.js";
import { ui, useUi } from "../lib/ui.js";
import { wt, useWt, rowsOf, stepsOf, firstSentence, runFix, fixLabel, fixIcon, fixTitle, whyOf, openItem, SEV_RANK, LEVEL_TONE, LEVEL_LABEL, OLD_PM } from "../lib/watchtower.js";
import { register } from "../lib/registry.js";
import { iconFor, iconKey, hostOf, useIcons } from "../lib/icons.js";

const cx = U.cx;
const TABS = ["findings", "setup", "activity", "trust"];
const REASONS = ["Shared account", "Can't change it", "Not important", "Other"];
const FOR = [{ value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "0", label: "Until I restore it" }];
const EVENT_ICON = { failed_unlocks: "lock", success_after_failures: "lock-open", unusual_hour: "clock", new_device: "laptop", bulk_reveal: "eye", export: "file-down", ai_first_privileged: "bot", ai_denied: "bot", ai_burst: "bot", log_tampered: "shield-alert", vault_modified_externally: "file-lock-2", counter_reset: "rotate-ccw", clock_rollback: "history", risky_setting: "sliders-horizontal" };
const SOURCE = { cli: "CLI", desktop: "App", extension: "Browser extension", system: "APM" };
const GRADE_ICON = { success: "circle-check", warning: "circle-alert", danger: "triangle-alert" };
const sourceOf = (e) => (e.source === "mcp" ? e.actor || "AI assistant" : SOURCE[e.source] || e.actor || "");
const scoreTone = (s) => (s >= 80 ? "success" : s >= 50 ? "warning" : "danger");
const typing = () => { const el = document.activeElement; return !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable); };
const shortDate = (ts) => new Date(ts).toLocaleDateString("en-US", new Date(ts).getFullYear() === new Date().getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });

export function Watchtower() {
  useIcons();
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const u = useUi();
  const w = useWt();
  const tab = TABS.includes(u.route.tab) ? u.route.tab : "findings";
  const setTab = (t) => ui.go({ tab: t });
  const [kind, setKind] = React.useState(null);
  const [space, setSpace] = React.useState("all");
  const [showDismissed, setShowDismissed] = React.useState(false);
  const [open, setOpen] = React.useState(u.route.item || null);
  const [, tick] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const t = setInterval(tick, 20000); return () => clearInterval(t); }, []);
  React.useEffect(() => { if (u.route.item) ui.go({ item: null }); }, []);
  const rescan = async () => { const r = await wt.rescan(); if (r && r.ok) ui.toast({ title: "Rescanned", description: "Checked " + U.n(Number(r.itemsChecked) || 0, "item"), tone: "neutral", icon: "radar" }); };
  React.useEffect(() => {
    const k = (e) => { if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing() && !ui.get().dialog && !document.querySelector(".apm-drawer,.apm-overlay")) { e.preventDefault(); rescan(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const r = w.report;
  const all = prefs.space === "all";
  const cats = r ? r.categories.filter((c) => c.count > 0 && c.kind !== "setup") : [];
  const labels = r ? Object.fromEntries(r.categories.map((c) => [c.kind, c.label])) : {};
  const k = kind && cats.some((c) => c.kind === kind) ? kind : null;
  const rows = r ? rowsOf(r, { showDismissed, space: all ? space : "all" }).filter((x) => !k || x.findings.some((f) => f.kind === k && (!f.dismissed || x.dismissed))) : [];
  const openRows = r ? rowsOf(r, {}) : [];
  const dismissedCount = r ? r.findings.filter((f) => f.dismissed && f.kind !== "setup").length : 0;
  const setupTodo = r ? r.setup.filter((x) => !x.ok).length : 0;
  const spaces = all && disk.spaces.length > 0;
  const current = open && r ? rowsOf(r, { showDismissed: true }).find((x) => x.key === open) : null;
  React.useEffect(() => { if (open && r && !current) setOpen(null); }, [open, r, !!current]);
  return (
    <div className="page">
      <div className="page-bar drag" />
      <div className="page-inner" style={{ maxWidth: 900 }}>
        <A.PageHeader className="wt-head" title="Watchtower" actions={<>
          <A.Button size="sm" icon="refresh-cw" loading={w.scanning && !!r} disabled={!r && w.scanning} onClick={rescan} kbd="R">Rescan</A.Button>
          <A.Button size="sm" variant="ghost" icon="eraser" onClick={() => ui.open("cleanup")}>Clean up</A.Button>
        </>} />
        {!r ? (w.error ? <A.Callout tone="warning" title={w.unsupported ? "Watchtower needs a newer pm" : "Watchtower could not check the vault"} action={<A.Button size="sm" onClick={rescan}>Try again</A.Button>}>{w.error}</A.Callout>
          : <div className="wt-loading" role="status"><A.Spinner size={16} /><span>Checking your vault…</span></div>) : <>
          {w.error && <A.Hint tone="danger" icon="triangle-alert">{w.error}</A.Hint>}
          <Summary r={r} rows={openRows} />
          <A.Tabs label="Watchtower" value={tab} onChange={setTab} items={[
            { value: "findings", label: "Fix these first", count: openRows.length },
            { value: "setup", label: "Setup", count: setupTodo },
            { value: "activity", label: "Activity", count: w.unack || 0 },
            { value: "trust", label: "Trust" }
          ]} />
          {tab === "findings" && <div className="stack-12 wt-tab">
            {(cats.length > 0 || spaces || dismissedCount > 0) && <div className="wt-filters">
              {cats.length > 0 && <div className="wt-pills" role="group" aria-label="Show problems of one kind">
                <A.Chip selected={!k} count={cats.reduce((n, c) => n + c.count, 0)} onClick={() => setKind(null)}>All</A.Chip>
                {cats.map((c) => <A.Chip key={c.kind} selected={k === c.kind} count={c.count} onClick={() => setKind(k === c.kind ? null : c.kind)}>{c.label}</A.Chip>)}
              </div>}
              {(spaces || dismissedCount > 0) && <div className="wt-filters-end">
                {spaces && <A.Select size="sm" ariaLabel="Space" value={space} onChange={setSpace} options={[{ value: "all", label: "All spaces" }, { value: "", label: "Default" }].concat(disk.spaces.map((s) => ({ value: s.name, label: s.name })))} />}
                {dismissedCount > 0 && <A.Checkbox checked={showDismissed} onChange={setShowDismissed} label={"Show dismissed (" + dismissedCount + ")"} />}
              </div>}
            </div>}
            {rows.length === 0 ? (
              k || (all && space !== "all") ? <A.EmptyState icon="list-filter" title="Nothing here" action={<A.Button size="sm" onClick={() => { setKind(null); setSpace("all"); }}>Show everything</A.Button>}>No findings match this filter.</A.EmptyState>
                : <A.EmptyState icon="shield-check" title="Nothing to fix">{"Every item passed. Watchtower checks again whenever the vault changes." + (setupTodo ? " Setup has " + U.n(setupTodo, "suggestion") + "." : "")}</A.EmptyState>
            ) : (
              <div className="wt-list">
                {rows.map((x) => <Row key={x.key} row={x} labels={labels} disk={disk} showSpace={spaces} active={open === x.key} onClick={() => setOpen(x.key)} />)}
              </div>
            )}
          </div>}
          {tab === "setup" && <Setup r={r} />}
          {tab === "activity" && <Activity w={w} disk={disk} />}
          {tab === "trust" && <TrustTable r={r} disk={disk} />}
        </>}
      </div>
      {current && <FindingDrawer row={current} r={r} disk={disk} onClose={() => setOpen(null)} onPick={(id) => setOpen(id)} />}
    </div>
  );
}

function Summary({ r, rows }) {
  const tone = scoreTone(r.score);
  const items = rows.filter((x) => x.itemId).length;
  const t = r.trend;
  const h = r.history;
  return (
    <div className="wt-sum">
      <span className="wt-score"><span className="display">{r.score}</span><span className="wt-of">of 100</span></span>
      {r.grade && <span className="wt-grade"><A.Icon name={GRADE_ICON[tone]} size={14} className={"is-" + tone} />Grade {r.grade}</span>}
      {t && <span className="wt-trend">
        {h.length > 1 && <A.Sparkline values={h.map((x) => x.score)} min={0} max={100} width={72} height={24} label={"Score over the last " + U.n(h.length, "day")} />}
        <span>{(t.delta > 0 ? "+" + t.delta : t.delta < 0 ? "−" + -t.delta : "No change") + (t.since ? " since " + shortDate(t.since) : "")}</span>
      </span>}
      <span className="wt-meta">{items ? <><b>{items} of {U.n(Math.max(items, r.itemsChecked), "item")}</b>{items === 1 ? " needs" : " need"} attention</> : "Nothing needs attention"} · checked {U.agoLong(r.generated)}</span>
    </div>
  );
}

function rowIcon(row, item) {
  const type = item ? item.type : row.type;
  if (!row.itemId) return { icon: "shield" };
  return { name: item ? titleOf(item) : row.title, icon: type === "password" ? undefined : getType(type).icon, src: item ? iconFor(item) : undefined };
}

function chipsOf(findings, labels) {
  const m = new Map();
  findings.forEach((f) => {
    const c = m.get(f.kind) || { key: f.kind, label: labels[f.kind] || f.title, severity: f.severity, impact: 0 };
    if (SEV_RANK[f.severity] > SEV_RANK[c.severity]) c.severity = f.severity;
    c.impact += f.impact;
    m.set(f.kind, c);
  });
  return Array.from(m.values()).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.impact - a.impact);
}

function Row({ row, labels, disk, showSpace, active, onClick }) {
  const item = row.itemId ? disk.items.find((i) => i.id === row.itemId) : null;
  const title = item ? titleOf(item) : row.title || (row.itemId ? "Deleted item" : "This vault");
  const shown = row.dismissed ? row.findings : row.findings.filter((f) => !f.dismissed);
  const sub = showSpace && row.itemId ? (item ? item.space : row.space) || "Default" : null;
  return <A.FindingRow {...rowIcon(row, item)} title={title} subtitle={sub} active={active} dismissed={row.dismissed} impact={row.dismissed ? 0 : row.impact} onClick={onClick} issues={chipsOf(shown, labels)} />;
}

const EDITS = ["change_password", "rotate", "enable_2fa", "add_passkey", "replace_key", "renew", "clear_exposed", "edit_item"];

function FindingDrawer({ row, r, disk, onClose, onPick }) {
  useIcons();
  const session = useStore((s) => s.session);
  const readonly = session.readonly;
  const [busy, setBusy] = React.useState(null);
  const [dismissing, setDismissing] = React.useState(null);
  const [showHidden, setShowHidden] = React.useState(false);
  React.useEffect(() => { setDismissing(null); setShowHidden(false); }, [row.key]);
  const item = row.itemId ? disk.items.find((i) => i.id === row.itemId) : null;
  const t = item ? getType(item.type) : row.type ? getType(row.type) : null;
  const title = item ? titleOf(item) : row.title || (row.itemId ? "Deleted item" : "This vault");
  const live = row.findings.filter((f) => !f.dismissed);
  const hidden = row.findings.filter((f) => f.dismissed);
  const steps = stepsOf(live);
  const host = (item && iconKey(item)) || hostOf((row.findings.find((f) => f.url) || {}).url);
  const impact = live.reduce((n, f) => n + f.impact, 0);
  const web = steps.findIndex((s) => !s.fixes.includes("open_change_url") && s.findings.some((f) => f.url));
  const run = async (x, s) => {
    const f = (x === "open_change_url" ? s.findings.find((y) => y.changeUrl) : x === "open_site" ? s.findings.find((y) => y.url) : null) || s.findings[0];
    if (x === "open_site") { runFix("open_change_url", Object.assign({}, f, { changeUrl: "" }), item); return; }
    if (x === "clear_exposed") { setBusy(x); await runFix(x, f, item); setBusy(null); return; }
    if (x !== "open_change_url") onClose();
    runFix(x, f, item);
  };
  const restore = async (f) => { setBusy(f.id); const res = await wt.restore(f.id); setBusy(null); if (res.ok) ui.toast({ title: "Restored", description: f.title, tone: "neutral", icon: "rotate-ccw" }); };
  const type = item ? item.type : row.type;
  return (
    <A.Drawer open onClose={onClose} width={460} title={title}
      name={title} src={item ? iconFor(item) : undefined} icon={!row.itemId ? "shield" : type === "password" ? undefined : t && t.icon}
      description={item ? [t.label, item.space || "Default", host].filter(Boolean).join(" · ") : row.itemId ? "This item is no longer in the vault" : "Settings that protect the whole vault"}
      actions={item && <A.IconButton icon="arrow-up-right" label="Open item" onClick={() => { onClose(); openItem(item.id); }} />}
      meta={live.length ? U.n(live.length, "problem") + ", " + U.n(steps.length, "fix", "fixes") : "Nothing to fix"}
      metaEnd={impact > 0 ? <>{live.length === 1 ? "Fixing it" : "Fixing all of them"}: <b>+{impact}<span className="apm-sr">{impact === 1 ? " point" : " points"}</span></b></> : null}>
      {steps.map((s, i) => (
        <A.FixStep key={s.fix || "none"} n={i + 1} primary={i === 0} title={fixTitle(s.fix)} impact={s.impact} why={whyOf(s)}
          actions={(s.fix || i === web) && <>
            {s.fixes.map((x, j) => <A.Button key={x} size="sm" variant={i === 0 && j === 0 ? "primary" : "secondary"} icon={fixIcon(x)} loading={busy === x} disabled={readonly && EDITS.includes(x)} data-autofocus={i === 0 && j === 0 ? "" : undefined} onClick={() => run(x, s)}>{fixLabel(x)}</A.Button>)}
            {i === web && <A.Button size="sm" variant="ghost" onClick={() => run("open_site", s)}>{"Open " + (hostOf((s.findings.find((f) => f.url) || {}).url) || "website")}</A.Button>}
          </>}>
          <A.ProblemList label="Problems this clears">
            {s.findings.map((f) => (
              <A.ProblemRow key={f.id} severity={f.severity} title={f.title} detail={detailOf(f, s.findings.length === 1, r, onPick)}
                menu={[{ label: "Dismiss", icon: "eye-off", disabled: readonly, onSelect: () => setDismissing(f.id) }]}>
                {dismissing === f.id && <Dismiss f={f} onCancel={() => setDismissing(null)} onDone={() => setDismissing(null)} />}
              </A.ProblemRow>
            ))}
          </A.ProblemList>
        </A.FixStep>
      ))}
      {hidden.length > 0 && <div className="wt-hidden">
        {live.length > 0 && <A.Button size="sm" variant="ghost" iconRight={showHidden ? "chevron-up" : "chevron-down"} aria-expanded={showHidden ? "true" : "false"} onClick={() => setShowHidden(!showHidden)}>Dismissed ({hidden.length})</A.Button>}
        {(showHidden || !live.length) && <A.ProblemList label="Dismissed problems">
          {hidden.map((f) => <A.ProblemRow key={f.id} dismissed severity={f.severity} title={f.title} detail={[f.dismissed.reason, f.dismissed.until ? "until " + U.date(f.dismissed.until) : "until you restore it"].filter(Boolean).join(" · ")}
            menu={[{ label: "Restore", icon: "rotate-ccw", disabled: readonly || busy === f.id, onSelect: () => restore(f) }]} />)}
        </A.ProblemList>}
      </div>}
    </A.Drawer>
  );
}

function detailOf(f, full, r, onPick) {
  const text = full ? String(f.body || "") : firstSentence(f.body);
  if (!f.group) return text;
  const others = r.findings.filter((x) => x.group === f.group && x.itemId && x.itemId !== f.itemId).filter((x, i, a) => a.findIndex((y) => y.itemId === x.itemId) === i);
  if (!others.length) return text;
  const link = (x, label, key) => <A.Button key={key} variant="link" onClick={() => onPick(x.itemId)}>{label}</A.Button>;
  const named = others.filter((x) => x.itemTitle && text.includes(x.itemTitle));
  if (!named.length) return <>{text} {others.map((x, i) => <React.Fragment key={x.itemId}>{i ? ", " : ""}{link(x, x.itemTitle || "Item")}</React.Fragment>)}</>;
  const re = new RegExp("(" + named.map((x) => x.itemTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|") + ")");
  return text.split(re).map((part, i) => { const x = named.find((y) => y.itemTitle === part); return x ? link(x, part, i) : part; });
}

function Dismiss({ f, onCancel, onDone }) {
  const [reason, setReason] = React.useState(REASONS[0]);
  const [other, setOther] = React.useState("");
  const [days, setDays] = React.useState("30");
  const [busy, setBusy] = React.useState(false);
  const form = React.useRef(null);
  React.useEffect(() => { const el = form.current && form.current.querySelector("select"); el && el.focus(); }, []);
  const text = reason === "Other" ? other.trim() : reason;
  const submit = async (e) => {
    e.preventDefault();
    if (!text || busy) return;
    setBusy(true);
    const r = await wt.dismiss(f.id, text, Number(days));
    setBusy(false);
    if (r.ok) onDone();
    if (r.ok) ui.toast({ title: "Dismissed", description: f.title + (days === "0" ? " · until you restore it" : " · for " + days + " days"), tone: "neutral", icon: "eye-off" });
  };
  return (
    <form className="wt-dismiss" onSubmit={submit} ref={form}>
      <A.Select size="sm" label="Reason" value={reason} onChange={setReason} options={REASONS} />
      {reason === "Other" && <A.Input size="sm" label="Your reason" placeholder="Why this doesn't apply" value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} autoFocus />}
      <div className="apm-field"><span className="apm-label">Hide it for</span><A.SegmentedControl label="Hide it for" options={FOR} value={days} onChange={setDays} /></div>
      <p className="wt-note">Dismissed problems don't count against your score. Restore them any time under Dismissed.</p>
      <div className="wt-dismiss-actions"><A.Button size="sm" variant="ghost" onClick={onCancel}>Cancel</A.Button><A.Button size="sm" type="submit" icon="eye-off" loading={busy} disabled={!text}>Dismiss</A.Button></div>
    </form>
  );
}

function Setup({ r }) {
  useIcons();
  const session = useStore((s) => s.session);
  const b = r.breach;
  const [checking, setChecking] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const check = async () => { setChecking(true); const res = await wt.breachCheck(); setChecking(false); if (res.ok) { const n = res.breach ? Number(res.breach.found) || 0 : 0; ui.toast(n ? { title: U.n(n, "password") + " found in breaches", description: "They're at the top of Fix these first.", tone: "warning", action: { label: "Show", onClick: () => ui.go({ tab: "findings" }) } } : { title: "No breached passwords found", description: "Checked " + U.n(res.breach ? Number(res.breach.checked) || 0 : 0, "password") }); } };
  const toggle = async (v) => { setToggling(true); await wt.breach(v); setToggling(false); };
  const status = !b.enabled ? "Off. Nothing leaves this computer." : checking ? "Checking…" : b.lastChecked ? "Last checked " + U.agoLong(b.lastChecked) + " · " + U.n(b.checked, "password") + " checked, " + b.found + " found" : "On. Not checked yet.";
  return (
    <div className="stack-16 wt-tab">
      <A.Card title="Vault setup" description="Settings that protect the whole vault, not one item." flush>
        {r.setup.length === 0 ? <div className="apm-card-empty">No setup checks from this version of pm.</div> : r.setup.map((x) => (
          <A.SettingRow key={x.id} className={cx("wt-setup", x.ok ? "is-ok" : "is-todo")} icon={x.ok ? "circle-check" : "circle-alert"} title={x.label} description={x.detail}>
            {x.ok ? <A.Status tone="success">Done</A.Status> : x.fix ? <A.Button size="sm" icon={fixIcon(x.fix)} onClick={() => runFix(x.fix, {})}>{fixLabel(x.fix)}</A.Button> : <A.Status tone="warning">Not set up</A.Status>}
          </A.SettingRow>
        ))}
      </A.Card>
      <A.Card id="wt-breach" title="Breach check" description="Compares your passwords with Have I Been Pwned's list of leaked passwords. Only the first 5 characters of a hash of each password leave this computer."
        footNote={<span aria-live="polite">{status}</span>}
        footer={<A.Button size="sm" icon="refresh-cw" loading={checking} disabled={!b.enabled || toggling} onClick={check}>Check now</A.Button>} flush>
        <A.SettingRow icon="shield-alert" title="Check passwords against known breaches" description="Runs when you choose Check now. Off by default.">
          <A.Switch label="Breach check" checked={b.enabled} disabled={toggling || session.readonly} onChange={toggle} />
        </A.SettingRow>
      </A.Card>
    </div>
  );
}

function Activity({ w, disk }) {
  useIcons();
  const [busy, setBusy] = React.useState(null);
  React.useEffect(() => { wt.activity(); }, []);
  const ack = async (id) => { setBusy(id); await wt.ack(id); setBusy(null); };
  const all = async () => { setBusy("all"); const r = await wt.ackAll(); setBusy(null); if (r.ok) ui.toast({ title: "Acknowledged all activity", tone: "neutral", icon: "check-check" }); };
  if (w.activityUnsupported) return <A.Callout tone="warning" title="Activity needs a newer pm">{OLD_PM}</A.Callout>;
  if (!w.activity) return <div className="wt-loading" role="status"><A.Spinner size={16} /><span>Loading activity…</span></div>;
  const list = w.activity;
  return (
    <div className="stack-12 wt-tab">
      <div className="wt-bar">
        <span className="wt-bar-note">{w.unack ? U.n(w.unack, "event") + " to review" : "Nothing to review"}</span>
        <span className="grow" />
        <A.Button size="sm" icon="check-check" disabled={!w.unack} loading={busy === "all"} onClick={all}>Acknowledge all</A.Button>
      </div>
      {!disk.meta.anomaly && <A.Callout title="Alerts for unusual activity are off" action={<A.Button size="sm" onClick={() => ui.go({ view: "settings", section: "alerts" })}>Turn on</A.Button>}>Everything here is still recorded. Turn them on to also raise a security alert for serious events.</A.Callout>}
      {list.length === 0 ? <A.EmptyState icon="activity" title="No unusual activity">Failed unlocks, new devices, AI agent spikes and other unusual events show up here.</A.EmptyState> : (
        <div className="wt-list" aria-live="polite">
          {list.map((e) => (
            <A.EventRow key={e.id} severity={e.severity} icon={EVENT_ICON[e.kind]} title={e.title} body={e.body} time={U.ago(e.at)} source={sourceOf(e)} acknowledged={e.acknowledged}
              action={e.acknowledged ? <span className="wt-acked"><A.Icon name="check" size={13} />Acknowledged</span> : <A.Button size="sm" loading={busy === e.id} onClick={() => ack(e.id)}>This was me</A.Button>} />
          ))}
        </div>
      )}
      <p className="wt-note">Recorded on this computer by pm and the app. Serious events also raise a security alert when alerts are on.</p>
    </div>
  );
}

function TrustTable({ r, disk }) {
  useIcons();
  const rows = r.trust.map((t) => Object.assign({ item: disk.items.find((i) => i.id === t.itemId) }, t)).filter((x) => x.item).sort((x, y) => x.score - y.score);
  if (!rows.length) return <A.EmptyState icon="gauge" title="No trust scores yet">Trust scores appear once the vault has items.</A.EmptyState>;
  return (
    <div className="trust-table wt-tab" role="table" aria-label="Trust scores">
      <div className="trust-row is-head" role="row"><span role="columnheader">Item</span><span role="columnheader">Score</span><span role="columnheader">Risk</span><span role="columnheader">Why</span></div>
      {rows.map((x) => (
        <button type="button" key={x.itemId} className="trust-row" role="row" onClick={() => openItem(x.itemId)}>
          <span className="trust-item" role="cell"><A.ItemIcon name={titleOf(x.item)} size="sm" icon={x.item.type === "password" ? undefined : getType(x.item.type).icon} src={iconFor(x.item)} /><b>{titleOf(x.item)}</b></span>
          <span className="trust-score" role="cell"><span className="mono">{x.score}</span><A.Progress value={x.score} tone={LEVEL_TONE[x.level]} /></span>
          <span role="cell"><A.Badge size="sm" tone={LEVEL_TONE[x.level]}>{LEVEL_LABEL[x.level]}</A.Badge></span>
          <span className="trust-why" role="cell">{x.reasons.length ? x.reasons.map((y) => y.text).join(" · ") : "No risk factors"}</span>
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
