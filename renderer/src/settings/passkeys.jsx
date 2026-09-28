import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui, openUrl } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { titleOf } from "../lib/types.js";
import { Card, Head, Status, Steps, Masked } from "./common.jsx";

const cx = U.cx;

export function Passkeys() {
  const disk = useStore((s) => s.disk);
  const b = disk.bridge;
  const [q, setQ] = React.useState("");
  const all = disk.items.flatMap((it) => (it.passkeys || []).map((p) => ({ it, p }))).sort((x, y) => (y.p.lastUsedAt || 0) - (x.p.lastUsedAt || 0));
  const shown = all.filter(({ it, p }) => !q || (p.rpId + " " + p.userName + " " + titleOf(it) + " " + (p.label || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Head title="Passkeys and extension" description="The APM Passkeys extension saves and uses passkeys from your vault. It talks to this app over a loopback bridge and cannot decrypt anything on its own." />
      <Card title="Browser bridge"
        footNote={b.running ? <span>Listening on <span className="mono-inline">127.0.0.1:{b.port}</span>. Loopback only. It answers only while the vault is unlocked.</span> : <span>Not running. Another app may be using port <span className="mono-inline">{b.port}</span>. Quit it and restart APM.</span>}>
        <div className="bridge">
          <div className="bridge-node"><span className="bridge-ic"><A.Icon name="globe" size={16} /></span><b>Browser</b><span className="muted small">APM Passkeys</span></div>
          <div className={cx("bridge-wire", b.running && "is-live")}><i /><span className="mono-small">bearer token</span></div>
          <div className="bridge-node"><span className="bridge-ic is-app"><A.Mark size={18} /></span><b>APM</b><span className="muted small">{b.running ? <Status tone="success" pulse>Running</Status> : <Status tone="neutral">Stopped</Status>}</span></div>
          <div className={cx("bridge-wire", b.running && "is-live")}><i /><span className="mono-small">decrypts</span></div>
          <div className="bridge-node"><span className="bridge-ic"><A.Icon name="file-lock-2" size={16} /></span><b>vault.dat</b><span className="muted small">{all.length} passkeys</span></div>
        </div>
      </Card>
      <Card title="Pairing token" description="Paste this into the extension once. Rotating it disconnects every paired browser."
        footer={<A.Button size="sm" icon="refresh-ccw" onClick={() => ui.open("confirm", { title: "Rotate the pairing token?", description: "Every browser using the old token is disconnected until you paste the new one.", icon: "refresh-ccw", confirm: "Rotate token", onConfirm: async () => { const r = await act.bridgeRotate(); if (r.ok) ui.toast({ title: "Pairing token rotated" }); } })}>Rotate</A.Button>}>
        <div className="token-box"><Masked value={b.token} keep={6} /></div>
      </Card>
      <Card title="Install the extension" description="Chrome, Edge, Arc and Brave. It asks only for storage and notifications.">
        <Steps items={[
          <span>Open <span className="mono-inline">chrome://extensions</span> and turn on <b>Developer mode</b>.</span>,
          <span>Choose <b>Load unpacked</b> and select the <span className="mono-inline">extension</span> folder from the APM repository. <button type="button" className="linkbtn" onClick={() => openUrl("https://github.com/aaravmaloo/apm/tree/master/extension")}>Get it on GitHub</button></span>,
          <span>Pin <b>APM Passkeys</b>, open it, paste the pairing token and choose <b>Connect</b>.</span>,
          <span>Create a passkey on any site. APM asks which item to save it to.</span>
        ]} />
      </Card>
      <Card title="Saved passkeys" description="The private key is stored encrypted inside the item it belongs to." flush
        actions={all.length > 4 ? <A.SearchField size="sm" placeholder="Filter passkeys" value={q} onChange={setQ} shortcut={null} /> : null}>
        {shown.length === 0 && <div className="card-empty">{all.length ? "No passkeys match." : "No passkeys yet. Create one on any site with the extension installed."}</div>}
        {shown.map(({ it, p }) => (
          <div key={p.credentialId || p.id} className="pk">
            <span className="pk-icon"><A.Icon name="fingerprint" size={16} /></span>
            <div className="pk-text">
              <div className="pk-top"><b>{p.rpId}</b>{p.label && <A.Badge size="sm" outline>{p.label}</A.Badge>}</div>
              <span className="muted small">{p.userName || "No user name"} · in <button type="button" className="linkish" onClick={() => { ui.go({ view: "vault", filter: "all" }); ui.select(it.id); }}>{titleOf(it)}</button> · used {p.lastUsedAt ? U.ago(p.lastUsedAt) : "never"} · {p.signCount} sign-ins</span>
            </div>
            <A.Menu align="end" width={200} trigger={<A.IconButton icon="ellipsis" label="Passkey actions" tip={false} />} items={[
              { label: "Rename", icon: "pencil", onSelect: () => ui.open("pk-rename", { credentialId: p.credentialId, label: p.label }) },
              { label: "Copy credential ID", icon: "copy", onSelect: () => { act.copyValue(p.credentialId); ui.toast({ title: "Credential ID copied", tone: "neutral" }); } },
              { separator: true },
              { label: "Remove", icon: "trash-2", danger: true, onSelect: () => ui.open("confirm", { title: "Remove the " + p.rpId + " passkey?", description: "You will not be able to sign in to " + p.rpId + " with it. Remove it from the site's security settings too.", icon: "fingerprint", tone: "danger", confirm: "Remove passkey", onConfirm: async () => { const r = await act.passkeyRemove(p.credentialId); if (r.ok) ui.toast({ title: "Passkey removed", tone: "neutral" }); } }) }
            ]} />
          </div>
        ))}
      </Card>
    </>
  );
}

function RenameDialog({ credentialId, label, onClose }) {
  const [v, setV] = React.useState(label || "");
  const go = async () => { if (!v.trim()) return; const r = await act.passkeyRename(credentialId, v); if (r.ok) ui.toast({ title: "Passkey renamed" }); onClose(); };
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="pencil" title="Rename passkey" description="A label to tell your passkeys apart, like the device you made it on."
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" onClick={go} disabled={!v.trim()}>Save</A.Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); go(); }}><A.Input label="Label" value={v} onChange={(e) => setV(e.target.value)} placeholder="MacBook Pro" autoFocus maxLength={120} /></form>
    </A.Dialog>
  );
}

register("pk-rename", RenameDialog);
