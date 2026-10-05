import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { TYPES, getType, titleOf } from "../lib/types.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { iconFor, useIcons } from "../lib/icons.js";
import { Cli } from "../ui/kit.jsx";

const cx = U.cx;

// Import, export and compare. Every file is read and planned by pm, so the
// app and `pm import` agree on what counts as new, a conflict or a duplicate.

export const SOURCES = [
  { id: "bitwarden", name: "Bitwarden", desc: "Tools > Export vault > .json. Passkeys come along, and password-protected files work too.", pk: true },
  { id: "1password", name: "1Password", desc: ".1pux from File > Export. 1Password leaves passkeys out of every export.", pk: false },
  { id: "keepass", name: "KeePass or KeePassXC", desc: "Database > Export > XML File. Passkeys saved by KeePassXC come along.", pk: true },
  { id: "cxf", name: "Credential Exchange", desc: "A FIDO Credential Exchange (CXF) .json file, with passkeys.", pk: true },
  { id: "apm", name: "APM export or backup", desc: "An APM .json export, or a vault.dat backup with its master password.", pk: true },
  { id: "generic", name: "Browser or other CSV", desc: "Chrome, Edge, Firefox or Safari passwords .csv, or a text file of otpauth:// links.", pk: false }
];

const OPEN_FILTERS = [{ name: "Exports", extensions: ["json", "1pux", "csv", "xml", "txt", "dat", "zip"] }, { name: "All files", extensions: ["*"] }];

const STATUS = {
  new: { label: "New", tone: "neutral" },
  identical: { label: "Already in vault", tone: "neutral" },
  conflict: { label: "Conflict", tone: "warning" },
  duplicate: { label: "Possible duplicate", tone: "warning" },
  invalid: { label: "Can't import", tone: "danger" }
};

const actionLabel = (a, row) => ({ add: row && row.match ? "Keep both" : "Add", skip: "Skip", merge: "Merge", replace: "Replace" }[a] || a);
const baseName = (p) => String(p || "").split(/[\\/]/).pop();
const plural = (n, w, pl) => U.n(n, w, pl);

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function readDropped(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(toB64(r.result));
    r.onerror = () => reject(r.error || new Error("Could not read " + file.name + "."));
    r.readAsArrayBuffer(file);
  });
}

// useFileSource turns a dialog pick or a drop into what transfer.preview
// takes: a path for picked files, the bytes for dropped ones.
function useFileSource() {
  const [file, setFile] = React.useState(null);
  const [src, setSrc] = React.useState(null);
  const choose = async () => {
    if (!window.apm || !window.apm.dialog) return null;
    const paths = await window.apm.dialog.open({ title: "Choose an export file", filters: OPEN_FILTERS });
    if (!paths || !paths[0]) return null;
    const s = { path: paths[0] };
    setFile({ name: baseName(paths[0]) }); setSrc(s);
    return s;
  };
  const drop = async (f) => {
    const data = await readDropped(f);
    const s = { name: f.name, data };
    setFile({ name: f.name, size: f.size }); setSrc(s);
    return s;
  };
  return { file, src, choose, drop, reset: () => { setFile(null); setSrc(null); } };
}

const show = (v) => {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "";
  if (typeof v === "object") return v.name || "";
  return String(v);
};

// compareRows lines up the vault item (or an earlier row of the file) with the
// incoming values, using the app's own field labels.
export function compareRows(row, left) {
  const t = getType(row.type);
  const right = row.fields || {};
  const changes = {};
  (row.changes || []).forEach((c) => { changes[c.key] = c; });
  const keys = [];
  const add = (k) => { if (!keys.includes(k)) keys.push(k); };
  t.fields.forEach((f) => add(f.key));
  Object.keys(right).forEach(add);
  Object.keys(changes).forEach(add);
  const out = [];
  keys.forEach((k) => {
    if (k === "file") return;
    const def = t.fields.find((f) => f.key === k) || {};
    const l = show(left && left[k]);
    const r = show(right[k]);
    if (!l && !r) return;
    const c = changes[k];
    const kind = c ? c.kind : l === r ? "same" : !l ? "added" : !r ? "same" : "changed";
    const secret = (c && c.secret) || ["password", "secret", "secretBlock", "totp", "codes"].includes(def.kind);
    out.push({ key: k, label: def.label || (c && c.label) || k, left: l, right: r, secret, mono: !!def.mono || def.kind === "secretBlock", kind });
  });
  return out;
}

function PasskeyList({ row }) {
  if (!row.passkeys.length && !row.dropped.length) return null;
  return (
    <div className="xfer-keys">
      {row.passkeys.map((p) => (
        <div key={p.credentialId} className="xfer-key">
          <A.Icon name="fingerprint" size={14} />
          <span className="ellipsis"><b>{p.rpId}</b>{p.userName ? " · " + p.userName : ""}</span>
          {p.inVault ? <A.Badge size="sm">Already in vault</A.Badge> : <A.Badge size="sm" tone="accent">New passkey</A.Badge>}
        </div>
      ))}
      {row.dropped.length > 0 && (
        <A.Callout tone="warning" title={plural(row.dropped.length, "passkey") + " can't come along"}>
          {row.dropped.map((d) => (d.rpId || "A passkey") + (d.userName ? " (" + d.userName + ")" : "") + ": " + d.reason + ".").join(" ")}
        </A.Callout>
      )}
    </div>
  );
}

function RowBadges({ row, showStatus = true }) {
  const st = STATUS[row.status] || STATUS.new;
  return (
    <>
      {showStatus && row.status !== "new" && <A.Badge size="sm" tone={st.tone}>{st.label}</A.Badge>}
      {row.passkeys.length > 0 && <A.Badge size="sm" tone="accent" icon="fingerprint">{plural(row.passkeys.length, "passkey")}</A.Badge>}
      {row.dropped.length > 0 && <A.Badge size="sm" tone="warning" icon="fingerprint">{row.dropped.length} left out</A.Badge>}
      {row.favorite && <A.Badge size="sm" icon="star">Favorite</A.Badge>}
    </>
  );
}

function rowIcon(row, vaultItem) {
  const t = getType(row.type);
  if (row.type !== "password") return { icon: t.icon };
  return { name: row.title, src: vaultItem ? iconFor(vaultItem) : undefined };
}

function RowDetail({ row, rows, disk, rightLabel }) {
  const m = row.match;
  let left = null, leftLabel = "Your vault";
  if (m && m.id) { const it = disk.items.find((x) => x.id === m.id); left = it ? it.f : null; leftLabel = "Your vault" + (m.space ? " · " + m.space : ""); }
  else if (m && m.row >= 0 && rows[m.row]) { left = rows[m.row].fields; leftLabel = "Earlier in this file"; }
  return (
    <>
      {row.reason && <span className="muted small">{row.reason}.</span>}
      {row.problems.length > 0 && <A.Callout tone="danger" title="This item can't be imported">{row.problems.join(". ")}.</A.Callout>}
      {row.warnings.length > 0 && <span className="muted small">{row.warnings.join(". ")}.</span>}
      {(m || row.status !== "invalid") && <A.CompareTable columns={{ left: m ? leftLabel : "Your vault", right: rightLabel }} rows={compareRows(row, left)} />}
      <PasskeyList row={row} />
    </>
  );
}

function PasswordStep({ label, pw, setPw, busy, err, onSubmit }) {
  return (
    <form className="stack-8" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <A.Input label={(label || "This export") + " is encrypted"} type="password" icon="key-round" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus hint="Enter the password chosen when it was exported. For a vault.dat backup, use that vault's master password." invalid={!!err} />
      <div><A.Button type="submit" variant="primary" size="sm" loading={busy} disabled={!pw}>Unlock file</A.Button></div>
    </form>
  );
}

function ErrorLine({ err }) {
  if (!err) return null;
  return <A.Hint tone="danger" icon="triangle-alert">{err}</A.Hint>;
}

// Import

function ImportDialog({ from: initialFrom, onClose }) {
  const disk = useStore((s) => s.disk);
  useIcons();
  const fs = useFileSource();
  const [step, setStep] = React.useState("source");
  const [from, setFrom] = React.useState(initialFrom || "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [locked, setLocked] = React.useState(null);
  const [pw, setPw] = React.useState("");
  const [res, setRes] = React.useState(null);
  const [plan, setPlan] = React.useState(null);
  const [dec, setDec] = React.useState({});
  const [touched, setTouched] = React.useState({});
  const [space, setSpace] = React.useState("");
  const [keep, setKeep] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const [type, setType] = React.useState("");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState({});
  const [limit, setLimit] = React.useState(200);
  const [result, setResult] = React.useState(null);
  const tokenRef = React.useRef(null);
  React.useEffect(() => () => { if (tokenRef.current) act.transferDiscard(tokenRef.current); }, []);

  const adopt = (p, keepTouched) => {
    setPlan(p);
    setDec((prev) => {
      const next = {};
      p.rows.forEach((r) => { const was = keepTouched && touched[r.index] ? prev[r.index] : null; next[r.index] = was && (was === "skip" || r.actions.includes(was)) ? was : r.default; });
      return next;
    });
  };

  const preview = async (src, password) => {
    if (!src) return;
    setBusy(true); setErr(null);
    const r = await act.transferPreview(Object.assign({}, src, { password: password || "", from, space: "", keepSpaces: false }));
    setBusy(false);
    if (!r.ok) {
      if (r.code === "needs_password") { setLocked({ label: (r.data && r.data.formatLabel) || "This export" }); return; }
      if (r.code === "wrong_password") { setLocked((l) => l || { label: "This export" }); setErr(r.error); return; }
      setLocked(null); setErr(r.error); return;
    }
    if (tokenRef.current && tokenRef.current !== r.token) act.transferDiscard(tokenRef.current);
    tokenRef.current = r.token;
    setLocked(null); setPw("");
    setRes(r);
    const k = !!(r.plan && r.plan.options && r.plan.options.keepSpaces);
    setKeep(k); setSpace((r.plan && r.plan.options && r.plan.options.space) || "");
    setTouched({}); setFilter(""); setType(""); setQ(""); setOpen({});
    adopt(r.plan, false);
    if (r.vendor === "apm" && r.plan.rows.some((x) => x.space)) replan("", true, r.token);
    setStep("review");
  };

  const replan = async (sp, k, token) => {
    setSpace(sp); setKeep(k);
    const r = await act.transferPlan(token || tokenRef.current, sp, k);
    if (r.ok && r.plan) adopt(r.plan, true); else if (!r.ok) setErr(r.error);
  };

  React.useEffect(() => { if (step === "source" && fs.src && !locked && err) preview(fs.src); }, [from]);

  const choose = async () => { const s = await fs.choose(); if (s) { setLocked(null); setPw(""); preview(s); } };
  const drop = async (f) => { try { const s = await fs.drop(f); setLocked(null); setPw(""); preview(s); } catch (e) { setErr((e && e.message) || "Could not read that file."); } };

  const rows = plan ? plan.rows : [];
  const sum = plan ? plan.summary : null;
  const setAction = (i, a) => { setDec((d) => Object.assign({}, d, { [i]: a })); setTouched((t) => Object.assign({}, t, { [i]: true })); };
  const bulk = (statuses, a) => {
    const nd = Object.assign({}, dec), nt = Object.assign({}, touched);
    rows.forEach((r) => { if (statuses.includes(r.status) && (a === "skip" || r.actions.includes(a))) { nd[r.index] = a; nt[r.index] = true; } });
    setDec(nd); setTouched(nt);
  };
  const included = rows.filter((r) => r.status !== "invalid" && dec[r.index] && dec[r.index] !== "skip");
  const newKeys = included.reduce((n, r) => n + (r.newPasskeys || 0), 0);
  const hasFolders = rows.some((r) => r.folder);
  const types = Array.from(new Set(rows.map((r) => r.type)));
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (filter === "passkeys" ? !(r.passkeys.length || r.dropped.length) : filter && r.status !== filter) return false;
    if (type && r.type !== type) return false;
    if (needle && !(r.title + " " + r.subtitle + " " + (r.folder || "")).toLowerCase().includes(needle)) return false;
    return true;
  });
  const stat = (key, label, value, tone, icon) => ({ key, label, value, tone, icon, active: filter === key, onClick: value ? () => setFilter(filter === key ? "" : key) : undefined });

  const apply = async () => {
    setBusy(true); setErr(null);
    const decisions = {};
    rows.forEach((r) => { decisions[r.index] = dec[r.index] || "skip"; });
    const r = await act.transferApply(tokenRef.current, space, keep, decisions);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    tokenRef.current = null;
    setResult(r.result || {});
    setStep("done");
  };

  const undo = async () => {
    setBusy(true);
    const r = await act.undo(1);
    setBusy(false);
    if (r.ok) { ui.toast({ title: "Import undone", description: "Your vault is back to how it was before the import.", icon: "undo-2" }); onClose(); }
    else ui.toast({ title: r.error, tone: "danger" });
  };

  const stepper = <A.Stepper items={[{ value: "source", label: "Source" }, { value: "review", label: "Review" }, { value: "done", label: "Done" }]} value={step} onChange={step === "review" ? (v) => { if (v === "source") setStep("source"); } : undefined} />;
  const importLabel = included.length ? "Import " + plural(included.length, "item") + (newKeys ? " and " + plural(newKeys, "passkey") : "") : "Nothing to import";

  let body, footer, footerStart;
  if (step === "source") {
    footerStart = <Cli cmd="pm import <file>" />;
    footer = <A.Button onClick={onClose}>Cancel</A.Button>;
    body = (
      <>
        <A.ChoiceGroup label="Import from" value={from} onChange={(v) => setFrom(v === from ? "" : v)} columns={3}>
          {SOURCES.map((s) => <A.ChoiceTile key={s.id} value={s.id} tile={{ name: s.name }} title={s.name} description={s.desc} meta={s.pk ? <A.Badge size="sm" tone="accent" icon="fingerprint">Passkeys</A.Badge> : null} />)}
        </A.ChoiceGroup>
        <A.FileDrop file={fs.file} busy={busy} title="Drop the export here or choose it"
          hint={from ? "APM reads " + SOURCES.find((s) => s.id === from).name + " exports. Pick the tile again to detect the format." : "APM works out the format from the file itself."}
          icon={fs.file ? "file" : "upload"} onChoose={choose} onDrop={drop} />
        {busy && fs.file && <span className="muted small xfer-busy"><A.Spinner size={14} />Reading {fs.file.name}…</span>}
        {locked && <PasswordStep label={locked.label} pw={pw} setPw={setPw} busy={busy} err={err} onSubmit={() => preview(fs.src, pw)} />}
        <ErrorLine err={err} />
      </>
    );
  } else if (step === "review" && plan) {
    footerStart = <span className="tnum">{included.length} of {rows.length} selected{sum.newPasskeys ? " · " + plural(newKeys, "new passkey") : ""}</span>;
    footer = <><A.Button onClick={onClose} disabled={busy}>Cancel</A.Button><A.Button variant="primary" icon="download" loading={busy} disabled={!included.length} onClick={apply}>{importLabel}</A.Button></>;
    const spaceOpts = [{ value: "", label: "Default" }].concat(disk.spaces.map((s) => ({ value: s.name, label: s.name })));
    body = (
      <>
        <div className="xfer-file">
          <A.ItemIcon name={res.formatLabel} size="sm" icon={res.encrypted ? "lock" : "file"} />
          <span className="ellipsis"><b>{res.fileName || (fs.file && fs.file.name)}</b> <span className="muted">· {res.formatLabel}</span></span>
          <A.Button variant="link" onClick={() => setStep("source")}>Choose another file</A.Button>
        </div>
        {(res.warnings || []).map((w, i) => <A.Callout key={i} tone="warning">{w}</A.Callout>)}
        <A.StatGroup label="What this file brings" items={[
          stat("new", "New", sum.new),
          stat("identical", "Already in vault", sum.identical),
          stat("conflict", "Conflicts", sum.conflicts, sum.conflicts ? "warning" : null, sum.conflicts ? "triangle-alert" : null),
          stat("duplicate", "Possible duplicates", sum.duplicates, sum.duplicates ? "warning" : null, sum.duplicates ? "copy" : null),
          stat("invalid", "Can't import", sum.invalid, sum.invalid ? "danger" : null, sum.invalid ? "circle-x" : null),
          stat("passkeys", "Passkeys", sum.passkeys, "accent", "fingerprint")
        ]} />
        <div className="xfer-bar">
          <A.Select size="sm" icon="layers" ariaLabel="Import into" value={keep ? "__keep" : space} onChange={(v) => v === "__keep" ? replan("", true) : replan(v, false)}
            options={(hasFolders || res.vendor === "apm" ? [{ value: "__keep", label: res.vendor === "apm" ? "Keep original spaces" : "Use folders as spaces" }] : []).concat(spaceOpts.map((o) => ({ value: o.value, label: "Into " + o.label })))} />
          {types.length > 1 && <A.Select size="sm" icon="filter" ariaLabel="Type" value={type} onChange={setType} options={[{ value: "", label: "All types" }].concat(types.map((t) => ({ value: t, label: getType(t).plural })))} />}
          <A.SearchField size="sm" placeholder="Filter" value={q} onChange={setQ} shortcut={null} className="grow" />
          <A.Menu align="end" label="Choose for many" trigger={<A.Button size="sm" iconRight="chevron-down" disabled={!(sum.conflicts + sum.duplicates + sum.identical + sum.new)}>Choose for many</A.Button>} items={[
            { section: "Conflicts and duplicates" },
            { label: "Merge where possible", icon: "copy-plus", hint: "Fills gaps, keeps your values", onSelect: () => bulk(["conflict", "duplicate"], "merge") },
            { label: "Replace with the file's values", icon: "refresh-cw", onSelect: () => bulk(["conflict", "duplicate"], "replace") },
            { label: "Keep both", icon: "files", onSelect: () => bulk(["conflict", "duplicate"], "add") },
            { label: "Skip them", icon: "x", onSelect: () => bulk(["conflict", "duplicate"], "skip") },
            { separator: true },
            { label: "Import all new items", icon: "check", onSelect: () => bulk(["new"], "add") },
            { label: "Skip all new items", icon: "minus", onSelect: () => bulk(["new"], "skip") }
          ]} />
        </div>
        {sum.spaces && sum.spaces.length > 0 && <span className="muted small">Creates {plural(sum.spaces.length, "space")}: {sum.spaces.join(", ")}.</span>}
        <div className="xfer-list" role="list">
          {shown.length === 0 && <A.EmptyState icon="search" title="Nothing matches">Clear the filter to see every item in the file.</A.EmptyState>}
          {shown.slice(0, limit).map((r) => {
            const a = dec[r.index] || "skip";
            const vi = r.match && r.match.id ? disk.items.find((x) => x.id === r.match.id) : null;
            const expandable = r.status !== "new" || r.passkeys.length > 0 || r.dropped.length > 0 || r.warnings.length > 0;
            return (
              <A.ReviewRow key={r.index} {...rowIcon(r, vi)} title={r.title || "Untitled"} subtitle={[r.subtitle, r.folder && !keep ? "Folder " + r.folder : ""].filter(Boolean).join(" · ") || getType(r.type).label}
                checked={r.status !== "invalid" && a !== "skip"} disabled={r.status === "invalid"}
                onCheck={(on) => setAction(r.index, on ? (r.default !== "skip" ? r.default : r.actions.find((x) => x !== "skip") || "add") : "skip")}
                tone={r.status === "invalid" ? "danger" : r.status === "conflict" || r.status === "duplicate" ? "warning" : undefined}
                badges={<RowBadges row={r} />}
                trailing={r.status !== "invalid" && r.actions.length > 1 ? <A.Select size="sm" ariaLabel={"What to do with " + r.title} value={a} onChange={(v) => setAction(r.index, v)} options={r.actions.map((x) => ({ value: x, label: actionLabel(x, r) }))} /> : null}
                expanded={!!open[r.index]} onToggle={expandable ? () => setOpen(Object.assign({}, open, { [r.index]: !open[r.index] })) : undefined}>
                {expandable ? <RowDetail row={r} rows={rows} disk={disk} rightLabel={res.fileName || "This file"} /> : null}
              </A.ReviewRow>
            );
          })}
          {shown.length > limit && <div className="xfer-more"><A.Button size="sm" onClick={() => setLimit(limit + 300)}>Show {Math.min(300, shown.length - limit)} more</A.Button></div>}
        </div>
        <ErrorLine err={err} />
      </>
    );
  } else if (step === "done" && result) {
    const done = [["Added", result.added], ["Merged", result.merged], ["Replaced", result.replaced], ["Skipped", result.skipped]].filter((x) => x[1]);
    footerStart = <Cli cmd="pm lgit undo" />;
    footer = <><A.Button icon="undo-2" loading={busy} onClick={undo} disabled={!(result.added || result.merged || result.replaced)}>Undo import</A.Button><A.Button variant="primary" onClick={onClose}>Done</A.Button></>;
    body = (
      <>
        <A.StatGroup label="Import result" items={done.map(([l, v]) => ({ key: l, label: l, value: v })).concat(result.passkeysAdded ? [{ key: "pk", label: "Passkeys added", value: result.passkeysAdded, tone: "accent", icon: "fingerprint" }] : [])} />
        {result.passkeysAdded > 0 && <A.Callout tone="accent" icon="fingerprint" title="Passkeys are ready">Sign in with them through the APM browser extension on the same sites as before.</A.Callout>}
        {result.spacesCreated && result.spacesCreated.length > 0 && <span className="muted small">Created {plural(result.spacesCreated.length, "space")}: {result.spacesCreated.join(", ")}.</span>}
        {result.renamed && result.renamed.length > 0 && <span className="muted small">Renamed to keep both: {result.renamed.join(", ")}.</span>}
        {result.errors && result.errors.length > 0 && <A.Callout tone="danger" title={plural(result.errors.length, "item") + " failed"}>{result.errors.join(". ")}.</A.Callout>}
        {!res.encrypted && <A.Callout tone="warning" title={"Delete " + (res.fileName || "the export file")}>It holds your passwords in plain text. APM does not touch the original file.</A.Callout>}
      </>
    );
  }

  return (
    <A.Dialog open onClose={busy ? undefined : onClose} size={step === "source" ? "lg" : "xl"} icon="download" title="Import items" className="xfer-dialog"
      description={step === "source" ? "Bring in logins, passkeys, one-time codes, notes and more. Nothing is written until you review it." : step === "review" ? "Check what happens to each item. Conflicts and duplicates never overwrite your vault unless you choose Replace." : "The import is one entry in your vault history."}
      footerStart={footerStart} footer={footer}>
      {stepper}
      {body}
    </A.Dialog>
  );
}

// Export

const FALLBACK_EXPORTERS = [
  { id: "apm", label: "APM", ext: "json", passkeys: true, encryption: true, files: true, secrets: true, help: "Everything, including passkeys, spaces and favorites." },
  { id: "cxf", label: "Credential Exchange", ext: "json", passkeys: true, help: "The FIDO Credential Exchange Format." },
  { id: "bitwarden", label: "Bitwarden", ext: "json", passkeys: true, encryption: true, help: "Bitwarden's JSON export." },
  { id: "csv", label: "CSV", ext: "csv", secrets: true, help: "One row per item." },
  { id: "txt", label: "Text", ext: "txt", secrets: true, help: "A readable list." }
];

const EXPORT_BLURB = {
  apm: "Every item, passkeys, spaces and favorites. Argon2id and AES-256-GCM.",
  cxf: "The FIDO standard for moving passkeys between managers.",
  bitwarden: "Bitwarden's .json, with passkeys and an optional password.",
  csv: "Columns most browsers and managers read. No passkeys.",
  txt: "A readable list. Leave secrets out to print it."
};

function ExportDialog({ ids, onClose }) {
  const disk = useStore((s) => s.disk);
  const [exporters, setExporters] = React.useState(FALLBACK_EXPORTERS);
  const [format, setFormat] = React.useState("apm");
  const [scope, setScope] = React.useState(ids && ids.length ? "selected" : "all");
  const [spaces, setSpaces] = React.useState([]);
  const [types, setTypes] = React.useState([]);
  const [passkeys, setPasskeys] = React.useState(true);
  const [files, setFiles] = React.useState(false);
  const [secrets, setSecrets] = React.useState(true);
  const [encrypt, setEncrypt] = React.useState(true);
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [sum, setSum] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => { act.transferFormats().then((r) => { if (r.ok && r.exporters && r.exporters.length) setExporters(r.exporters); }); }, []);
  const ex = exporters.find((x) => x.id === format) || exporters[0];
  React.useEffect(() => { setEncrypt(format === "apm"); setPw(""); setPw2(""); }, [format]);
  const usesPw = ex.encryption && encrypt;
  const sel = () => {
    const o = { format, passkeys: !!ex.passkeys && passkeys, files: !!ex.files && files, secrets: format === "csv" || format === "txt" ? secrets : true };
    if (scope === "selected" && ids) o.ids = ids;
    if (scope === "spaces") o.spaces = spaces.length ? spaces : ["__none__"];
    if (scope === "types") o.types = types.length ? types : ["__none__"];
    return o;
  };
  React.useEffect(() => {
    let live = true;
    const t = setTimeout(() => { act.exportPreview(Object.assign(sel(), { password: usesPw && pw ? "x" : "" })).then((r) => { if (live) setSum(r.ok ? r.summary : null); }); }, 160);
    return () => { live = false; clearTimeout(t); };
  }, [format, scope, spaces.join("\u0000"), types.join("\u0000"), passkeys, files, secrets, usesPw, !!pw]);
  const strength = pw ? U.strength(pw) : null;
  const pwOk = !usesPw || (pw.length >= 8 && pw === pw2);
  const plainSecrets = !usesPw && (format === "csv" || format === "txt" ? secrets : true);
  const presentTypes = Array.from(new Set(disk.items.map((i) => i.type)));
  const go = async () => {
    const date = new Date().toISOString().slice(0, 10);
    const name = (format === "apm" ? "apm-export-" : format === "cxf" ? "apm-credentials-" : format === "bitwarden" ? "bitwarden-from-apm-" : "apm-export-") + date + "." + (ex.ext || "json");
    const path = await window.apm.dialog.save({ title: "Export items", defaultPath: name, filters: [{ name: ex.label, extensions: [ex.ext || "json"] }] });
    if (!path) return;
    setBusy(true); setErr(null);
    const r = await act.exportFile(Object.assign(sel(), { path, password: usesPw ? pw : "" }));
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    const s = r.summary || sum || {};
    ui.toast({ title: "Exported " + plural(s.items || 0, "item"), description: baseName(path) + (s.passkeys ? " · " + plural(s.passkeys, "passkey") : ""), icon: "file-down", action: { label: "Show", onClick: () => window.apm.shell.showItemInFolder(path) } });
    onClose();
  };
  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : list.concat([v]));
  const scopeOpts = [{ value: "all", label: "Whole vault" }].concat(ids && ids.length ? [{ value: "selected", label: ids.length + " selected" }] : []).concat([{ value: "spaces", label: "By space" }, { value: "types", label: "By type" }]);
  return (
    <A.Dialog open onClose={busy ? undefined : onClose} size="lg" icon="file-down" title={ids && ids.length ? "Export " + plural(ids.length, "selected item") : "Export items"} className="xfer-dialog"
      description="An export leaves the vault's protection. Encrypt it, and delete the file when you are done."
      footerStart={<span className="tnum">{sum ? plural(sum.items, "item") + (sum.passkeys ? " · " + plural(sum.passkeys, "passkey") : "") + (sum.files ? " · " + plural(sum.files, "file") : "") : "…"}</span>}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" icon="file-down" loading={busy} disabled={!pwOk || !sum || !sum.items} onClick={go}>Export</A.Button></>}>
      <A.ChoiceGroup label="Format" value={format} onChange={setFormat} columns={3}>
        {exporters.map((x) => (
          <A.ChoiceTile key={x.id} value={x.id} icon={x.id === "apm" ? "shield-check" : x.id === "cxf" ? "arrow-up-down" : x.id === "bitwarden" ? "key-round" : x.id === "csv" ? "list" : "file-text"}
            title={x.id === "apm" ? "APM (recommended)" : x.label} description={EXPORT_BLURB[x.id] || x.help}
            meta={<>{x.passkeys && <A.Badge size="sm" tone="accent" icon="fingerprint">Passkeys</A.Badge>}{x.encryption && <A.Badge size="sm" icon="lock">Encrypted</A.Badge>}{x.files && <A.Badge size="sm" icon="files">Files</A.Badge>}</>} />
        ))}
      </A.ChoiceGroup>
      <div className="stack-8">
        <A.SegmentedControl label="What to export" options={scopeOpts} value={scope} onChange={setScope} />
        {scope === "spaces" && <div className="xfer-picks">{[{ id: "", name: "Default" }].concat(disk.spaces).map((s) => <A.Checkbox key={s.name} label={s.name} checked={spaces.includes(s.id || "default")} onChange={() => toggle(spaces, setSpaces, s.id || "default")} />)}</div>}
        {scope === "types" && <div className="xfer-picks">{TYPES.filter((t) => presentTypes.includes(t.id)).map((t) => <A.Checkbox key={t.id} label={t.plural} checked={types.includes(t.id)} onChange={() => toggle(types, setTypes, t.id)} />)}</div>}
      </div>
      <A.FieldGroup>
        {ex.passkeys && <A.SettingRow icon="fingerprint" title="Include passkeys" description="Private keys go into the file so you can sign in elsewhere. Anyone with the file can use them."><A.Switch checked={passkeys} onChange={setPasskeys} label="Include passkeys" /></A.SettingRow>}
        {ex.files && <A.SettingRow icon="files" title="Include files" description="Documents, photos, audio and video, embedded in the file. It can get large."><A.Switch checked={files} onChange={setFiles} label="Include files" /></A.SettingRow>}
        {(format === "csv" || format === "txt") && <A.SettingRow icon="key-round" title="Include secrets" description={format === "csv" ? "Plain-text passwords. Needed to import elsewhere." : "Leave off for a printable inventory of what you have."}><A.Switch checked={secrets} onChange={setSecrets} label="Include secrets" /></A.SettingRow>}
        {ex.encryption && <A.SettingRow icon="lock" title="Encrypt with a password" description={format === "bitwarden" ? "Bitwarden asks for it when you import. PBKDF2-SHA256, AES-256-CBC and HMAC-SHA256." : "You need it to import the file again. Argon2id and AES-256-GCM."}><A.Switch checked={encrypt} onChange={setEncrypt} label="Encrypt export" /></A.SettingRow>}
        {usesPw && (
          <div className="pad-16 stack-8">
            <div className="grid-2 is-top">
              <A.Input type="password" label="Export password" icon="key-round" value={pw} onChange={(e) => setPw(e.target.value)} invalid={!!pw && pw.length < 8} hint={pw && pw.length < 8 ? "Use at least 8 characters." : "Not your master password. Pick a new one."} />
              <A.Input type="password" label="Confirm password" icon="key-round" value={pw2} onChange={(e) => setPw2(e.target.value)} invalid={!!pw2 && pw2 !== pw} hint={pw2 && pw2 !== pw ? "The passwords do not match." : " "} />
            </div>
            {strength && <A.StrengthMeter score={strength.score} bits={strength.bits} />}
          </div>
        )}
      </A.FieldGroup>
      {sum && (
        <div className="xfer-sum">
          <div className="tagrow">{Object.keys(sum.byType || {}).map((t) => <A.Badge key={t} icon={getType(t).icon}>{sum.byType[t]} {getType(t).plural.toLowerCase()}</A.Badge>)}{sum.passkeys > 0 && <A.Badge tone="accent" icon="fingerprint">{plural(sum.passkeys, "passkey")}</A.Badge>}</div>
          {(sum.excluded || []).map((x, i) => <span key={i} className="muted small"><A.Icon name="minus" size={12} /> {x.reason} · {x.count}</span>)}
        </div>
      )}
      {plainSecrets && sum && sum.items > 0 && <A.Callout tone="danger" title="This file will be readable by anyone">Anything that can read the folder you save it to can read every exported secret{sum.passkeys ? " and sign in with its passkeys" : ""}.</A.Callout>}
      <ErrorLine err={err} />
      <div><A.Button variant="link" onClick={() => ui.open("compare")}><A.Icon name="arrow-up-down" size={13} />Compare your vault with an earlier export</A.Button></div>
    </A.Dialog>
  );
}

// Compare

function CompareDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  useIcons();
  const fs = useFileSource();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [locked, setLocked] = React.useState(null);
  const [pw, setPw] = React.useState("");
  const [res, setRes] = React.useState(null);
  const [filter, setFilter] = React.useState("");
  const [pick, setPick] = React.useState({});
  const [open, setOpen] = React.useState({});
  const tokenRef = React.useRef(null);
  React.useEffect(() => () => { if (tokenRef.current) act.transferDiscard(tokenRef.current); }, []);
  const run = async (src, password) => {
    if (!src) return;
    setBusy(true); setErr(null);
    const r = await act.transferCompare(Object.assign({}, src, { password: password || "" }));
    setBusy(false);
    if (!r.ok) {
      if (r.code === "needs_password") { setLocked({ label: (r.data && r.data.formatLabel) || "This export" }); return; }
      if (r.code === "wrong_password") { setLocked((l) => l || { label: "This export" }); setErr(r.error); return; }
      setErr(r.error); return;
    }
    if (tokenRef.current) act.transferDiscard(tokenRef.current);
    tokenRef.current = r.token;
    setLocked(null); setPw(""); setRes(r); setFilter(""); setOpen({});
    const p = {}; r.plan.rows.forEach((x) => { if (x.status === "new") p[x.index] = true; }); setPick(p);
  };
  const choose = async () => { const s = await fs.choose(); if (s) run(s); };
  const drop = async (f) => { try { run(await fs.drop(f)); } catch (e) { setErr((e && e.message) || "Could not read that file."); } };
  const rows = res ? res.plan.rows : [];
  const only = rows.filter((r) => r.status === "new");
  const changed = rows.filter((r) => r.status === "conflict" || r.status === "duplicate");
  const same = rows.filter((r) => r.status === "identical");
  const vaultOnly = res ? res.vaultOnly || [] : [];
  const picked = only.filter((r) => pick[r.index]);
  const restore = async () => {
    setBusy(true); setErr(null);
    const decisions = {}; rows.forEach((r) => { decisions[r.index] = pick[r.index] && r.status === "new" ? "add" : "skip"; });
    const r = await act.transferApply(tokenRef.current, "", true, decisions);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    tokenRef.current = null;
    const n = (r.result && r.result.added) || 0;
    ui.toast({ title: "Restored " + plural(n, "item"), description: "From " + (res.fileName || "the export"), icon: "rotate-ccw" });
    onClose();
  };
  const f = (key, label, list, tone, icon) => ({ key, label, value: list.length, tone, icon, active: filter === key, onClick: list.length ? () => setFilter(filter === key ? "" : key) : undefined });
  const show = (k) => !filter || filter === k;
  const fileRow = (r, checkable) => (
    <A.ReviewRow key={"r" + r.index} {...rowIcon(r, r.match && r.match.id ? disk.items.find((x) => x.id === r.match.id) : null)} title={r.title} subtitle={[r.subtitle, r.space].filter(Boolean).join(" · ") || getType(r.type).label}
      checked={checkable ? !!pick[r.index] : undefined} onCheck={checkable ? (v) => setPick(Object.assign({}, pick, { [r.index]: v })) : undefined}
      tone={r.status === "conflict" || r.status === "duplicate" ? "warning" : undefined}
      badges={<>{r.status === "new" && <A.Badge size="sm" tone="accent">Only in the file</A.Badge>}{(r.status === "conflict" || r.status === "duplicate") && <A.Badge size="sm" tone="warning">Changed</A.Badge>}<RowBadges row={r} showStatus={false} /></>}
      expanded={!!open[r.index]} onToggle={() => setOpen(Object.assign({}, open, { [r.index]: !open[r.index] }))}>
      <RowDetail row={r} rows={rows} disk={disk} rightLabel={res.fileName || "The file"} />
    </A.ReviewRow>
  );
  return (
    <A.Dialog open onClose={busy ? undefined : onClose} size="xl" icon="arrow-up-down" title="Compare with an export" className="xfer-dialog"
      description="See what changed since an export or backup: what the file has that your vault lost, what changed, and what is new since."
      footerStart={<Cli cmd="pm export compare <file>" />}
      footer={<><A.Button onClick={onClose} disabled={busy}>Close</A.Button>{res && <A.Button variant="primary" icon="rotate-ccw" loading={busy} disabled={!picked.length} onClick={restore}>{picked.length ? "Restore " + plural(picked.length, "item") + " only in the file" : "Nothing to restore"}</A.Button>}</>}>
      <A.FileDrop file={fs.file ? Object.assign({}, fs.file, res ? { detail: res.formatLabel + " · click to choose another" } : {}) : null} busy={busy} title="Drop an export or backup here or choose one" hint="APM, 1Password, Bitwarden, KeePass, Credential Exchange or CSV. Nothing is changed until you restore." onChoose={choose} onDrop={drop} />
      {locked && <PasswordStep label={locked.label} pw={pw} setPw={setPw} busy={busy} err={err} onSubmit={() => run(fs.src, pw)} />}
      {res && (
        <>
          <A.StatGroup label="Comparison" items={[f("file", "Only in the file", only, only.length ? "accent" : null, only.length ? "file" : null), f("changed", "Changed", changed, changed.length ? "warning" : null, changed.length ? "triangle-alert" : null), f("same", "Same", same), f("vault", "Only in your vault", vaultOnly)]} />
          {rows.length + vaultOnly.length > 0 && only.length + changed.length + vaultOnly.length === 0 && <A.Callout tone="success" title="Nothing changed">Your vault holds exactly what this file holds.</A.Callout>}
          <div className="xfer-list" role="list">
            {show("file") && only.map((r) => fileRow(r, true))}
            {show("changed") && changed.map((r) => fileRow(r, false))}
            {show("vault") && vaultOnly.map((v) => {
              const it = disk.items.find((x) => x.id === v.id);
              const t = getType(v.type);
              return <A.ReviewRow key={"v" + v.id} title={v.title} subtitle={[v.subtitle, v.space].filter(Boolean).join(" · ") || t.label} {...(v.type === "password" ? { name: v.title, src: it ? iconFor(it) : undefined } : { icon: t.icon })} badges={<A.Badge size="sm" tone="success">New since the export</A.Badge>} />;
            })}
            {filter === "same" && same.map((r) => fileRow(r, false))}
          </div>
        </>
      )}
      <ErrorLine err={err} />
    </A.Dialog>
  );
}

register("import", ImportDialog);
register("export", ExportDialog);
register("compare", CompareDialog);
