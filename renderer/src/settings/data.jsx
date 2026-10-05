import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { ui, saveFile } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { titleOf, getType, INJECT } from "../lib/types.js";
import { Card, Head } from "./common.jsx";
import { Cli } from "../ui/kit.jsx";
import { iconFor, useIcons } from "../lib/icons.js";

const cx = U.cx;
const envName = (it) => titleOf(it).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export function ImportExport() {
  const disk = useStore((s) => s.disk);
  const lastExport = disk.audit.find((e) => e.action === "DATA_EXPORTED");
  const lastImport = disk.audit.find((e) => e.action === "DATA_IMPORTED");
  const passkeys = disk.items.reduce((n, i) => n + (i.passkeys ? i.passkeys.length : 0), 0);
  return (
    <>
      <Head title="Import and export" description="Move your vault in and out of APM, passkeys included. You review every item before anything is written, and exports can be encrypted with a separate password." />
      <div className="io">
        <div className="io-card">
          <button type="button" className="io-hit" aria-label="Import items" onClick={() => ui.open("import")} disabled={disk.readonly} />
          <span className="io-ic"><A.Icon name="file-up" size={18} /></span>
          <b>Import</b>
          <span>1Password, Bitwarden, KeePass, Credential Exchange, browser CSV or an APM export. Passkeys come along where the source includes them.</span>
          <span className="io-meta">{lastImport ? "Last import " + U.ago(lastImport.ts) : "Nothing imported yet"}</span>
          <Cli cmd="pm import <file>" />
        </div>
        <div className="io-card">
          <button type="button" className="io-hit" aria-label="Export items" onClick={() => ui.open("export")} />
          <span className="io-ic"><A.Icon name="file-down" size={18} /></span>
          <b>Export</b>
          <span>APM with every item type, Credential Exchange or Bitwarden with passkeys, or CSV and text. {passkeys ? U.n(passkeys, "passkey") + " can come along." : ""}</span>
          <span className="io-meta">{lastExport ? "Last export " + U.ago(lastExport.ts) : "Never exported"}</span>
          <Cli cmd="pm export --format cxf" />
        </div>
        <div className="io-card">
          <button type="button" className="io-hit" aria-label="Compare with an export" onClick={() => ui.open("compare")} />
          <span className="io-ic"><A.Icon name="arrow-up-down" size={18} /></span>
          <b>Compare</b>
          <span>Check an export or backup against your vault: what is only in the file, what changed and what is new since. Restore what you lost.</span>
          <span className="io-meta">Nothing changes until you restore</span>
          <Cli cmd="pm export compare <file>" />
        </div>
      </div>
      <Card title="Encrypted backup" description="A byte-for-byte copy of vault.dat. It opens with your current master password and nothing else, and you can compare it with your vault later."
        footNote={"Includes " + U.n(disk.items.length, "item") + " and " + U.n(disk.spaces.length, "space") + ". History snapshots are not included."}
        footer={<A.Button size="sm" icon="download" onClick={() => act.backup()}>Save a backup</A.Button>} />
    </>
  );
}

export function Developer() {
  const disk = useStore((s) => s.disk);
  useIcons();
  const pool = disk.items.filter((i) => INJECT[i.type]);
  const [pick, setPick] = React.useState(() => pool.filter((i) => ["apikey", "token", "docker"].includes(i.type)).slice(0, 3).map((i) => i.id));
  const [names, setNames] = React.useState({});
  const [shell, setShell] = React.useState("zsh");
  const [q, setQ] = React.useState("");
  const chosen = pool.filter((i) => pick.includes(i.id));
  const nameOf = (i) => names[i.id] != null ? names[i.id] : envName(i);
  const cmd = "pm inject --inject \"" + chosen.map(titleOf).join(",") + "\"";
  const yaml = chosen.length ? chosen.map((i) => "- entry: " + JSON.stringify(titleOf(i)) + "\n  as: " + nameOf(i)).join("\n") : "# pick items above";
  const shown = pool.filter((i) => !q || titleOf(i).toLowerCase().includes(q.toLowerCase()));
  const setup = { zsh: "pm inject setup-shell\nsource ~/.zshrc\n\ninject \"Stripe live key,Docker Hub\"", bash: "pm inject setup-shell\nsource ~/.bashrc\n\ninject \"Stripe live key,Docker Hub\"", fish: "pm inject setup-shell\nsource ~/.config/fish/config.fish\n\ninject \"Stripe live key,Docker Hub\"", powershell: "pm inject setup-shell\n. $PROFILE\n\ninject \"Stripe live key,Docker Hub\"" }[shell];
  return (
    <>
      <Head title="Developer" description="Put secrets into your shell as environment variables for one session, then wipe them. Nothing is written to disk." cli="pm inject" />
      <Card title="Inject into a shell" description="Pick items and name the variables. Commit a .apminject file so teammates get the same names from their own vaults." flush>
        <div className="inj">
          <div className="inj-pick">
            <A.SearchField size="sm" placeholder="Filter items" value={q} onChange={setQ} shortcut={null} />
            <div className="inj-list">
              {shown.map((i) => (
                <label key={i.id} className={cx("inj-item", pick.includes(i.id) && "is-on")}>
                  <input type="checkbox" checked={pick.includes(i.id)} onChange={() => setPick(pick.includes(i.id) ? pick.filter((x) => x !== i.id) : pick.concat([i.id]))} />
                  <A.ItemIcon name={titleOf(i)} size="sm" icon={i.type === "password" ? undefined : getType(i.type).icon} src={iconFor(i)} />
                  <span className="ellipsis">{titleOf(i)}</span>
                  <span className="muted small">{getType(i.type).label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="inj-vars">
            <div className="envtable">
              <div className="env-row is-head"><span>Variable</span><span>From</span><span>Value</span></div>
              {chosen.length === 0 && <div className="apm-card-empty">Pick at least one item.</div>}
              {chosen.map((i) => (
                <div key={i.id} className="env-row">
                  <input className="env-name mono" value={nameOf(i)} onChange={(e) => setNames(Object.assign({}, names, { [i.id]: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") }))} aria-label={"Variable for " + titleOf(i)} spellCheck={false} />
                  <span className="ellipsis small">{titleOf(i)} <span className="muted">· {INJECT[i.type]}</span></span>
                  <span className="mono-small muted">••••{String(i.f[INJECT[i.type]] || "").slice(-4)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="apm-card-pad stack-12">
          <A.CodeBlock label="Run" wrap>{cmd}</A.CodeBlock>
          <div className="grid-2 is-top">
            <A.CodeBlock label=".apminject" maxHeight={170} copy={yaml}>{yaml}</A.CodeBlock>
            <div className="stack-8 inj-notes">
              <span className="muted small">pm looks for <span className="mono-inline">.apminject</span> in the current folder and its parents, so a plain <span className="mono-inline">pm inject</span> works inside the project.</span>
              <A.Button size="sm" icon="file-down" disabled={!chosen.length} onClick={() => saveFile(".apminject", yaml + "\n", "text/yaml")}>Save .apminject</A.Button>
              <span className="muted small">End the session and wipe the variables with <span className="mono-inline">pm inject kill</span>.</span>
            </div>
          </div>
        </div>
      </Card>
      <Card title="Shell function" description="Installs an inject function so you do not need eval. Run it once per shell." cli="pm inject setup-shell">
        <div className="stack-12">
          <A.SegmentedControl label="Shell" value={shell} onChange={setShell} options={[{ value: "zsh", label: "zsh" }, { value: "bash", label: "bash" }, { value: "fish", label: "fish" }, { value: "powershell", label: "PowerShell" }]} />
          <A.CodeBlock label={shell}>{setup}</A.CodeBlock>
        </div>
      </Card>
      <CommandLine />
    </>
  );
}

const ENGINE_SOURCE = { bundled: "Inside APM.app", env: "From APM_PM_PATH", dev: "Development build", path: "From your PATH", missing: "Missing" };
const home = (p) => String(p || "").replace(/^\/Users\/[^/]+/, "~");

function CommandLine() {
  const info = useStore((s) => s.info) || {};
  const status = useStore((s) => s.status) || {};
  const app = (window.apm && window.apm.app) || {};
  const managed = typeof app.cliStatus === "function";
  const engine = info.engine || { path: info.pmPath || "", source: info.pmPath ? "" : "missing" };
  const env = "export APM_VAULT_PATH=\"" + (status.path || "") + "\"";
  return (
    <Card title="Command line" flush cli="which pm">
      {managed && <PmCommand app={app} />}
      {(info.engine || info.pmPath) && <A.SettingRow title="Engine" description={<span className="mono-inline path-wrap">{home(engine.path) || "Not found"}</span>}><A.Status tone={engine.path && engine.source !== "missing" ? "success" : "warning"}>{ENGINE_SOURCE[engine.source] || (engine.path ? "Found" : "Missing")}</A.Status></A.SettingRow>}
      <A.SettingRow title="Use this vault from the terminal" description={<span>pm uses a <span className="mono-inline">vault.dat</span> next to itself if there is one, otherwise <span className="mono-inline">~/.apm/vault.dat</span>. <span className="mono-inline">APM_VAULT_PATH</span> points it anywhere else.</span>}><A.Button size="sm" icon="copy" onClick={() => { act.copyValue(env); ui.toast({ title: "Copied the export line", description: "Add it to your shell profile.", tone: "neutral", icon: "copy" }); }}>Copy export</A.Button></A.SettingRow>
    </Card>
  );
}

// Checks the pm a terminal runs each time this page opens: install it if there
// is none, update an older one in one click, or just say it is up to date.
function PmCommand({ app }) {
  const [cli, setCli] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const refresh = React.useCallback(async () => {
    try { setCli((await app.cliStatus()) || { supported: false }); }
    catch (e) { setCli({ supported: false, reason: (e && e.message) || "Could not check the pm command." }); }
  }, [app]);
  React.useEffect(() => { refresh(); }, [refresh]);
  const run = async (kind) => {
    setBusy(true);
    try {
      if (kind === "install") { await app.installCli(); ui.toast({ title: "Installed the pm command", description: "Open a new terminal window and run pm.", icon: "terminal" }); }
      else { await app.updateCli(); ui.toast({ title: "Updated pm to " + cli.version, description: "Your terminal now runs this app's engine.", icon: "terminal" }); }
    } catch (e) {
      if (!(e && e.code === "cancelled")) ui.toast({ title: (e && e.message) || "Could not " + kind + " the pm command.", tone: "danger", icon: "triangle-alert", duration: 4200 });
    }
    setBusy(false);
    refresh();
  };
  const found = (cli && cli.found) || {};
  const at = <span className="mono-inline">{home(found.path)}</span>;
  let description, action = null;
  if (!cli) description = "Checking…";
  else if (!cli.supported) description = cli.reason || "Not available on this system.";
  else if (cli.state === "missing") {
    description = "Not installed. Adds pm to your terminal, linked to this app, so updating APM updates it too.";
    action = <A.Button size="sm" variant="primary" icon="terminal" loading={busy} onClick={() => run("install")}>Install pm</A.Button>;
  } else if (cli.state === "outdated") {
    description = <span>{found.version ? "pm " + found.version : "An older pm"} is installed at {at}. This app has {cli.version}.</span>;
    action = <A.Button size="sm" variant="primary" icon="refresh-cw" loading={busy} onClick={() => run("update")}>Update pm</A.Button>;
  } else if (cli.state === "homebrew") {
    description = <span>pm {found.version} from Homebrew is at {at}. This app has {cli.version}. Homebrew manages it, so upgrade it there.</span>;
    action = <A.Button size="sm" icon="copy" onClick={() => { act.copyValue("brew upgrade pm"); ui.toast({ title: "Copied brew upgrade pm", description: "Run it in a terminal.", tone: "neutral", icon: "copy" }); }}>Copy command</A.Button>;
  } else if (cli.state === "newer") {
    description = <span>pm {found.version} at {at} is newer than this app ({cli.version}). Update APM to match it.</span>;
    action = <A.Status tone="warning">Newer than APM</A.Status>;
  } else {
    description = <span>pm {cli.version}{found.path ? <> at {at}</> : null}.</span>;
    action = <A.Status tone="success">Up to date</A.Status>;
  }
  return <A.SettingRow icon="terminal" title="pm command" description={description}>{action}</A.SettingRow>;
}

export function Maintenance() {
  const disk = useStore((s) => s.disk);
  const status = useStore((s) => s.status) || {};
  const [scan, setScan] = React.useState(null);
  React.useEffect(() => { let live = true; act.cleanupScan().then((r) => { if (live && r.ok) setScan(r.issues || []); }); return () => { live = false; }; }, [disk.meta.modified, disk.items.length]);
  const snapCount = disk.commits.filter((c) => c.snapshot).length;
  const snaps = disk.commits.reduce((n, c) => n + (c.snapshot ? c.bytes || 0 : 0), 0);
  const vault = status.size || 0;
  const seg = [["Vault", vault, "var(--text)"], ["History snapshots", snaps, "var(--accent)"]];
  const total = vault + snaps;
  const verify = async () => { const r = await act.verify(); if (r.ok) ui.toast({ title: r.good === r.total ? "All " + r.total + " commits verified" : (r.total - r.good) + " of " + r.total + " commits failed", tone: r.good === r.total ? "success" : "danger", icon: "shield-check" }); else ui.toast({ title: r.error, tone: "danger" }); };
  const prune = async () => { const r = await act.prune(); if (r.ok) ui.toast({ title: "Pruned " + (r.removed || 0) + " file" + (r.removed === 1 ? "" : "s"), description: (r.kept != null ? r.kept + " snapshots kept" : null) }); };
  return (
    <>
      <Head title="Maintenance" description="Keep the vault tidy and small. Nothing here changes a secret without asking." cli="pm loaded" />
      <Card title="Storage" footNote={U.bytes(total) + " for the vault and its history"}>
        <div className="storage-bar">{seg.map(([k, v, c]) => <i key={k} style={{ flexGrow: Math.max(v, 1), background: c }} title={k} />)}</div>
        <div className="storage-legend">{seg.map(([k, v, c]) => <span key={k}><i style={{ background: c }} />{k}<b className="mono-small">{U.bytes(v)}</b></span>)}</div>
      </Card>
      <Card flush>
        <A.SettingRow icon="eraser" title="Clean up" description={scan == null ? "Checking…" : scan.length ? scan.length + " thing" + (scan.length === 1 ? "" : "s") + " to look at: empty names, broken authenticators, missing spaces, duplicates." : "Nothing to clean up."}><Cli cmd="pm cleanup" /><A.Button size="sm" onClick={() => ui.open("cleanup")} disabled={disk.readonly}>{scan && scan.length ? "Review" : "Run"}</A.Button></A.SettingRow>
        <A.SettingRow icon="history" title="Prune snapshots" description={"Deletes snapshot files that no commit points to. " + snapCount + " snapshots are in use."}><Cli cmd="pm lgit prune" /><A.Button size="sm" onClick={prune}>Prune</A.Button></A.SettingRow>
        <A.SettingRow icon="archive" title="Squash history" description={disk.commits.length + " commits. Keep the newest and drop the rest."}><Cli cmd="pm lgit squash" /><A.Button size="sm" onClick={() => ui.open("squash")} disabled={disk.commits.length < 2}>Squash</A.Button></A.SettingRow>
        <A.SettingRow icon="shield-check" title="Verify integrity" description="Checks every commit signature in the history chain."><Cli cmd="pm lgit verify" /><A.Button size="sm" onClick={verify}>Verify</A.Button></A.SettingRow>
      </Card>
      <Card danger title="Danger zone" flush>
        <A.SettingRow danger icon="triangle-alert" title="Destroy this vault" description="Deletes vault.dat, its history snapshots and sessions from this Mac. There is no undo, and synced copies are not touched."><A.Button size="sm" variant="danger" onClick={() => ui.open("destroy")} disabled={disk.readonly}>Destroy vault</A.Button></A.SettingRow>
      </Card>
    </>
  );
}

function DestroyDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState("ask");
  const [err, setErr] = React.useState(null);
  const go = async () => { setPhase("run"); setErr(null); const r = await act.destroy(disk.meta.name); if (!r.ok) { setPhase("ask"); setErr(r.error); return; } ui.close(); };
  return (
    <A.Dialog open onClose={phase === "run" ? undefined : onClose} size="sm" icon="triangle-alert" tone="danger" title={"Destroy “" + disk.meta.name + "”?"} description={U.n(disk.items.length, "item") + " and " + U.n(disk.commits.length, "history commit") + " are deleted from this Mac."}
      footer={phase === "ask" ? <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="danger" disabled={typed !== disk.meta.name} onClick={go}>Destroy vault</A.Button></> : null}>
      {phase === "ask" ? (
        <div className="stack-12">
          {disk.sync.providers.some((p) => p.connected) && <A.Callout tone="warning" title="Synced copies stay">Encrypted copies on {disk.sync.providers.filter((p) => p.connected).map((p) => ({ github: "GitHub", gdrive: "Google Drive", dropbox: "Dropbox" }[p.id] || p.id)).join(" and ")} are not deleted.</A.Callout>}
          <A.Input label={<span>Type <b className="mono-inline">{disk.meta.name}</b> to confirm</span>} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
          {err && <A.Hint tone="danger" icon="triangle-alert">{err}</A.Hint>}
        </div>
      ) : <div className="destroy-run"><A.Spinner size={16} /><span>Deleting vault.dat and its history…</span></div>}
    </A.Dialog>
  );
}

register("destroy", DestroyDialog);
