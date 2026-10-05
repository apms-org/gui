import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { getType } from "../lib/types.js";
import { Card, Head } from "./common.jsx";
import { Cli } from "../ui/kit.jsx";

const cx = U.cx;
export const PROVIDERS = [
  { id: "github", name: "GitHub", blurb: "A private repository you own. Every sync is a commit.", detail: (p) => p.repo || "Repository", modes: [{ value: "pat", label: "Personal access token" }] },
  { id: "gdrive", name: "Google Drive", blurb: "Your own Drive, or APM's shared bucket with a retrieval key.", detail: (p) => (p.mode === "self_hosted" ? "Your Drive" : "APM public bucket") + (p.fileId ? " · file " + String(p.fileId).slice(0, 10) + "…" : ""), modes: [{ value: "self_hosted", label: "My Google Drive" }, { value: "apm_public", label: "APM public" }] },
  { id: "dropbox", name: "Dropbox", blurb: "Your own Dropbox app, or APM's shared app with a retrieval key.", detail: (p) => (p.mode === "self_hosted" ? "Your Dropbox app" : "APM public app") + (p.fileId ? " · " + String(p.fileId).slice(0, 18) : ""), modes: [{ value: "self_hosted", label: "My Dropbox app" }, { value: "apm_public", label: "APM public" }] }
];
const pName = (id) => (PROVIDERS.find((p) => p.id === id) || {}).name || id;
const icon = (id) => (id === "github" ? "git-branch" : id === "gdrive" ? "hard-drive" : "package");

export function Sync() {
  const disk = useStore((s) => s.disk);
  const syncing = useStore((s) => !!s.busy.sync);
  const sy = disk.sync;
  const on = sy.providers.filter((p) => p.connected);
  const last = Math.max(0, ...on.map((p) => p.last || 0), sy.lastSync || 0);
  const now = async (id) => { const n = await act.syncNow(id); if (n) ui.toast({ title: "Synced to " + (id ? pName(id) : n + " provider" + (n === 1 ? "" : "s")), icon: "cloud-check" }); };
  return (
    <>
      <Head title="Sync" description="The vault is encrypted on this Mac before upload. Providers store ciphertext and never see your password or your items." cli="pm cloud sync" />
      <div className="sync-hero">
        <div className={cx("sync-orb", syncing && "is-busy", on.length && "is-on")}><A.Icon name={on.length ? (syncing ? "refresh-cw" : "cloud-check") : "cloud-off"} size={20} className={cx(syncing && "spin")} /></div>
        <div className="sync-hero-text">
          <b>{!on.length ? "Local only" : syncing ? "Syncing…" : last ? "Up to date" : "Connected"}</b>
          <span className="muted">{on.length ? (last ? "Last synced " + U.agoLong(last) : "Not synced from this Mac yet") + " · " + on.map((p) => pName(p.id)).join(" and ") : "Connect a provider to keep a copy off this Mac."}</span>
        </div>
        <span className="grow" />
        <div className="sync-hero-actions">
          <label className="inline-switch"><span>Auto-sync</span><A.Switch label="Auto-sync" checked={!!sy.auto} onChange={(v) => act.syncAuto(v)} disabled={!on.length} /></label>
          <A.Button size="sm" variant="primary" icon="refresh-cw" loading={syncing} disabled={!on.length} onClick={() => now()}>Sync now</A.Button>
        </div>
      </div>
      <Card title="Providers" description="Connect as many as you like. Each gets the same encrypted file." flush cli="pm cloud init">
        {PROVIDERS.map((P) => {
          const p = sy.providers.find((x) => x.id === P.id);
          const connected = p && p.connected;
          return (
            <div key={P.id} className="prov">
              <span className={cx("prov-logo", "is-" + P.id)}><A.Icon name={icon(P.id)} size={16} /></span>
              <div className="prov-text">
                <div className="prov-top"><b>{P.name}</b>{connected && (p.state === "error" ? <A.Status tone="danger">Last sync failed</A.Status> : p.last ? <A.Status tone="success">Synced {U.ago(p.last)}</A.Status> : <A.Status tone="neutral">Connected</A.Status>)}</div>
                <span className="prov-desc">{connected ? <span className="mono-small">{P.detail(p)}{p.error ? " · " + p.error : ""}</span> : P.blurb}</span>
              </div>
              {connected ? (
                <>
                  <A.Button size="sm" variant="ghost" onClick={() => ui.open("sync-diff", { id: P.id })}>Compare</A.Button>
                  <A.Menu align="end" width={220} trigger={<A.IconButton icon="ellipsis" label={"More for " + P.name} tip={false} />} items={[
                    { label: "Sync now", icon: "refresh-cw", onSelect: () => now(P.id) },
                    { label: "Compare with local", icon: "arrow-up-down", onSelect: () => ui.open("sync-diff", { id: P.id }) },
                    p.retrievalKey ? { label: "Show retrieval key", icon: "key-round", onSelect: () => ui.open("sync-key", { id: P.id }) } : null,
                    { separator: true },
                    { label: "Disconnect", icon: "unlink", danger: true, onSelect: () => ui.open("confirm", { title: "Disconnect " + P.name + "?", description: "Stops syncing. The encrypted copy stays in " + P.name + " until you delete it there.", icon: "unlink", tone: "danger", confirm: "Disconnect", onConfirm: async () => { const r = await act.syncDisconnect(P.id); if (r.ok) ui.toast({ title: "Disconnected " + P.name, tone: "neutral" }); } }) }
                  ].filter(Boolean)} />
                </>
              ) : <A.Button size="sm" onClick={() => ui.open("sync-connect", { id: P.id })} disabled={disk.readonly}>Connect</A.Button>}
            </div>
          );
        })}
      </Card>
      <IgnoreEditor />
      <Card title="Restore on another device" description="Install pm, then pull the vault down with your retrieval key or repo. You still need your master password to open it. The app does the same from Welcome, Restore from cloud." cli="pm cloud get gdrive <retrieval-key>" />
    </>
  );
}

const IGNORE_HELP = [
  ["[spaces]", "Space names or globs to keep local. scratch-*"],
  ["[entries]", "space:type:name. Homelab:note:Homelab runbook"],
  ["[cloud-specific-ignore]", "provider:space:type:name. gdrive:Work:apikey:*"],
  ["[misc]", "ignore:history leaves History local"]
];

function IgnoreEditor() {
  const disk = useStore((s) => s.disk);
  const [v, setV] = React.useState(disk.sync.ignore || "");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setV(disk.sync.ignore || ""); }, [disk.sync.ignore]);
  const dirty = v !== (disk.sync.ignore || "");
  const lines = v.split("\n").filter((l) => l.trim() && !/^\s*[#\[]/.test(l)).length;
  const save = async () => { setBusy(true); const r = await act.syncIgnore(v); setBusy(false); if (r.ok) ui.toast({ title: ".apmignore saved", description: "Applies from the next sync." }); };
  return (
    <Card title=".apmignore" description="Keep parts of the vault off one or all providers. Applied before encryption, so ignored items never leave this Mac."
      footNote={dirty ? "Unsaved changes" : (disk.sync.ignorePath ? disk.sync.ignorePath.replace(/^\/Users\/[^/]+/, "~") + " · " : "") + lines + " rule" + (lines === 1 ? "" : "s")}
      footer={<><A.Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setV(disk.sync.ignore || "")}>Discard</A.Button><A.Button size="sm" variant="primary" loading={busy} disabled={!dirty} onClick={save}>Save</A.Button></>}>
      <div className="ignore">
        <div className="ignore-edit">
          <div className="ignore-gutter" aria-hidden="true">{v.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}</div>
          <textarea className="ignore-ta mono" value={v} onChange={(e) => setV(e.target.value)} spellCheck={false} rows={Math.max(8, v.split("\n").length)} aria-label=".apmignore" placeholder={"[spaces]\n\n[entries]\n\n[cloud-specific-ignore]\n\n[misc]\n"} />
        </div>
        <div className="ignore-help">{IGNORE_HELP.map(([k, d]) => <div key={k}><span className="mono-small">{k}</span><span>{d}</span></div>)}</div>
      </div>
    </Card>
  );
}

function ConnectDialog({ id: initial, onClose }) {
  const disk = useStore((s) => s.disk);
  const [id, setId] = React.useState(initial || null);
  const P = PROVIDERS.find((p) => p.id === id);
  const [mode, setMode] = React.useState(P ? P.modes[0].value : null);
  const [step, setStep] = React.useState(initial ? 1 : 0);
  const [token, setToken] = React.useState("");
  const [repo, setRepo] = React.useState("");
  const [appKey, setAppKey] = React.useState("");
  const [appSecret, setAppSecret] = React.useState("");
  const [consent, setConsent] = React.useState(true);
  const [customKey, setCustomKey] = React.useState("");
  const [err, setErr] = React.useState(null);
  const [out, setOut] = React.useState(null);
  const pick = (x) => { setId(x.id); setMode(x.modes[0].value); setStep(1); setErr(null); };
  const ready = P && (P.id === "github" ? /^[\w.-]+\/[\w.-]+$/.test(repo) && token.length > 8 : P.id === "dropbox" && mode === "self_hosted" ? appKey && appSecret : true);
  const connect = async () => {
    setStep(2); setErr(null);
    const r = await act.syncConnect({ provider: P.id, mode, token: token.trim(), repo: repo.trim(), consent: P.id !== "github" && consent, retrievalKey: customKey.trim(), appKey: appKey.trim(), appSecret: appSecret.trim() });
    if (!r.ok) { setStep(1); setErr(r.error); return; }
    setOut(r); setStep(3);
  };
  const oauth = P && ((P.id === "gdrive" && mode === "self_hosted") || (P.id === "dropbox" && mode === "self_hosted"));
  return (
    <A.Dialog open onClose={step === 2 ? undefined : onClose} size="md" icon={step === 3 ? "cloud-check" : "cloud"} tone={step === 3 ? "success" : undefined}
      title={step === 0 ? "Connect a provider" : step === 3 ? "Connected to " + P.name : "Connect " + P.name}
      description={step === 0 ? "You can add more later." : step === 1 ? P.blurb : step === 2 ? (oauth ? "Finish signing in in your browser. Keep this window open." : "Encrypting and uploading. Keep the app open.") : "The first encrypted copy is uploaded."}
      footer={step === 1 ? <><A.Button onClick={() => (initial ? onClose() : setStep(0))}>{initial ? "Cancel" : "Back"}</A.Button><A.Button variant="primary" disabled={!ready} onClick={connect}>{oauth ? "Sign in and upload" : "Connect and upload"}</A.Button></> : step === 3 ? <A.Button variant="primary" onClick={onClose}>Done</A.Button> : step === 0 ? <A.Button onClick={onClose}>Cancel</A.Button> : null}>
      {step === 0 && <div className="choice-list">{PROVIDERS.map((x) => { const c = disk.sync.providers.find((p) => p.id === x.id && p.connected); return <A.ChoiceTile key={x.id} variant="list" arrow disabled={!!c} onClick={() => pick(x)} leading={<span className={cx("prov-logo", "is-" + x.id)}><A.Icon name={icon(x.id)} size={16} /></span>} title={x.name} badge={c ? <A.Badge size="sm" tone="success">Connected</A.Badge> : null} description={x.blurb} />; })}</div>}
      {step === 1 && P && (
        <div className="stack-16">
          {P.modes.length > 1 && <A.SegmentedControl label="Where" value={mode} onChange={(v) => { setMode(v); setErr(null); }} options={P.modes} />}
          {P.id === "github" && <>
            <A.Input label="Repository" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="you/apm-vault" icon="git-branch" hint="A private repository you own." autoFocus />
            <A.Input label="Personal access token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" icon="key-round" hint="Fine-grained, with Contents: read and write on that repository only." />
          </>}
          {P.id === "dropbox" && mode === "self_hosted" && <div className="grid-2">
            <A.Input label="App key" value={appKey} onChange={(e) => setAppKey(e.target.value)} icon="key" autoFocus />
            <A.Input label="App secret" type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} icon="key-round" />
          </div>}
          {oauth && <A.Callout tone="accent" title="Your browser opens next">Sign in there and allow access. APM only sees the file it creates.</A.Callout>}
          {P.id !== "github" && mode === "apm_public" && <A.Callout tone="accent" title="Shared bucket, your ciphertext">The encrypted vault is stored in APM's public space. Only someone with your retrieval key can find it, and they still need your master password.</A.Callout>}
          {P.id !== "github" && <div className="stack-8">
            <A.Checkbox checked={consent} onChange={setConsent} label="Create a retrieval key" description="Stores a one-way hash of the key with the file, so you can restore on another device with just the key." />
            {consent && <A.Input label="Custom retrieval key" value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="Leave blank to generate one" icon="key-round" className="mono-input" />}
          </div>}
          {err && <A.Hint tone="danger" icon="triangle-alert">{err}</A.Hint>}
          <Cli cmd={"pm cloud init " + P.id} />
        </div>
      )}
      {step === 2 && <div className="touch-wait"><A.Spinner size={20} /><span>{oauth ? "Waiting for the browser…" : "Uploading the encrypted vault…"}</span></div>}
      {step === 3 && P && (out && out.retrievalKey ? <div className="stack-12"><A.CodeBlock label="Retrieval key" copy={out.retrievalKey}>{out.retrievalKey}</A.CodeBlock><p className="help">Keep it with your recovery key. You can see it again from the provider menu.</p></div> : <A.KeyValueList><A.KeyValue label="Location" mono>{P.id === "github" ? repo : P.detail({ mode, fileId: out && out.fileId })}</A.KeyValue><A.KeyValue label="Encrypted with">{disk.meta.cipher}</A.KeyValue></A.KeyValueList>)}
    </A.Dialog>
  );
}

function KeyDialog({ id, onClose }) {
  const disk = useStore((s) => s.disk);
  const p = disk.sync.providers.find((x) => x.id === id) || {};
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="key-round" title={"Retrieval key for " + pName(id)} description="Anyone with this key can download the encrypted file. They still need your master password." footer={<A.Button variant="primary" onClick={onClose}>Done</A.Button>}>
      <A.CodeBlock label="Retrieval key" copy={p.retrievalKey}>{p.retrievalKey || "none"}</A.CodeBlock>
    </A.Dialog>
  );
}

function DiffDialog({ id, onClose }) {
  const P = PROVIDERS.find((p) => p.id === id);
  const [state, setState] = React.useState({ loading: true });
  const [pick, setPick] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    act.syncDiff(id).then((r) => {
      if (!live) return;
      if (!r.ok) { setState({ error: r.error }); return; }
      const rows = (r.changes || []).map((c, i) => ({ index: c.index != null ? c.index : i, kind: c.kind || c.Kind, type: c.type || c.ItemType, identifier: c.identifier || c.Identifier, space: c.space || c.Space || "", fields: c.fields || c.ChangedFields || [] }));
      setState({ rows });
      setPick(Object.fromEntries(rows.map((x) => [x.index, x.kind !== "removed"])));
    });
    return () => { live = false; };
  }, [id]);
  const rows = state.rows || [];
  const counts = { modified: rows.filter((r) => r.kind === "modified").length, added: rows.filter((r) => r.kind === "added").length, removed: rows.filter((r) => r.kind === "removed").length };
  const selected = rows.filter((r) => pick[r.index]).map((r) => r.index);
  const apply = async () => {
    setBusy(true);
    const r = await act.syncApply(id, selected);
    setBusy(false);
    if (r.ok) { ui.toast({ title: "Merged with " + P.name, description: selected.length + " change" + (selected.length === 1 ? "" : "s") + " taken from " + P.name + ", then uploaded" }); onClose(); }
  };
  const label = (k) => (k === "added" ? "Only on " + P.name : k === "removed" ? "Only on this Mac" : "Different on both");
  return (
    <A.Dialog open onClose={busy ? undefined : onClose} size="lg" icon="arrow-up-down" title={"This Mac and " + P.name} description="Both copies are decrypted and compared here. Tick the remote changes you want to take. Everything else keeps the local version, then the result is uploaded."
      footerStart={<Cli cmd={"pm cloud diff " + id} />}
      footer={<><A.Button onClick={onClose} disabled={busy}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={state.loading || !!state.error} onClick={apply}>{selected.length ? "Take " + selected.length + " and sync" : "Keep local and sync"}</A.Button></>}>
      {state.loading && <div className="touch-wait"><A.Spinner size={18} /><span>Downloading and decrypting the remote copy…</span></div>}
      {state.error && <A.Callout tone="danger" title="Could not compare">{state.error}</A.Callout>}
      {state.rows && (
        <>
          <div className="diff-sum"><span><b>{counts.modified}</b> changed on both</span><span><b>{counts.added}</b> only on {P.name}</span><span><b>{counts.removed}</b> only here</span></div>
          {rows.length === 0 && <A.Callout tone="success" title="Already in sync">The local vault and the {P.name} copy hold the same items.</A.Callout>}
          <div className="diff">
            {rows.map((r) => {
              const t = getType(r.type);
              return (
                <label key={r.index} className="diff-row">
                  <A.Checkbox checked={!!pick[r.index]} onChange={(v) => setPick(Object.assign({}, pick, { [r.index]: v }))} />
                  <A.ItemIcon name={r.identifier} size="sm" icon={t.id === "password" ? undefined : t.icon} />
                  <div className="diff-text"><b>{r.identifier}</b><span className="muted small">{label(r.kind)}{r.space ? " · " + r.space : ""}{r.fields.length ? " · " + r.fields.join(", ").toLowerCase() : ""}</span></div>
                  <A.Badge size="sm" tone={r.kind === "removed" ? "danger" : r.kind === "added" ? "success" : "accent"}>{r.kind === "removed" ? (pick[r.index] ? "Remove here" : "Keep") : r.kind === "added" ? (pick[r.index] ? "Add" : "Skip") : pick[r.index] ? "Take remote" : "Keep local"}</A.Badge>
                </label>
              );
            })}
          </div>
        </>
      )}
    </A.Dialog>
  );
}

register("sync-connect", ConnectDialog);
register("sync-diff", DiffDialog);
register("sync-key", KeyDialog);
