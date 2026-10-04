import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { titleOf } from "../lib/types.js";
import { CodeBlock } from "../ui/kit.jsx";
import { Card, Head, Status, Steps, Masked, useNow } from "./common.jsx";
import { PairCode, PairTimer, usePair } from "../screens/pair.jsx";

const cx = U.cx;
const LIVE_MS = 120000;
const activeFor = (ts, now) => { const a = U.ago(ts, now); return a === "now" ? "active now" : /^\d/.test(a) ? "active " + a + " ago" : "active " + a; };

function PendingPair({ p }) {
  const { left, busy, respond } = usePair(p);
  return (
    <div className="approval pair-pending">
      <div className="approval-top">
        <span className="pair-pending-ic"><A.Icon name="globe" size={16} /></span>
        <div className="approval-who"><b>{p.client || "A browser"}</b><span className="muted small">wants to connect to this vault</span></div>
        <span className="grow" />
        <PairCode code={p.code} size="sm" />
      </div>
      <div className="approval-foot">
        <PairTimer left={left} />
        <span className="grow" />
        <A.Button size="sm" onClick={() => respond(false)} loading={busy === "deny"} disabled={!!busy}>Deny</A.Button>
        <A.Button size="sm" variant="primary" onClick={() => respond(true)} loading={busy === "allow"} disabled={!!busy}>Connect</A.Button>
      </div>
    </div>
  );
}

export function Passkeys() {
  const disk = useStore((s) => s.disk);
  const pair = useStore((s) => s.pair);
  const b = disk.bridge;
  const now = useNow(15000);
  const seen = act.bridgeSeen();
  const live = !!(seen && now - seen.ts < LIVE_MS);
  const [q, setQ] = React.useState("");
  React.useEffect(() => { act.bridgeInfo(); }, []);
  const all = disk.items.flatMap((it) => (it.passkeys || []).map((p) => ({ it, p }))).sort((x, y) => (y.p.lastUsedAt || 0) - (x.p.lastUsedAt || 0));
  const shown = all.filter(({ it, p }) => !q || (p.rpId + " " + p.userName + " " + titleOf(it) + " " + (p.label || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Head title="Browser extension" description="APM for Chrome fills logins, one-time codes and passkeys from this vault. It talks to this app over a loopback bridge, or to pm when the app is closed, and cannot decrypt anything on its own." />
      <Card title="Browser bridge"
        actions={seen ? <Status tone={live ? "success" : "neutral"} pulse={live}>{(seen.client || "A browser") + " · " + activeFor(seen.ts, now)}</Status> : <Status tone="neutral">No browser connected yet</Status>}
        footNote={b.running ? <span>Listening on <span className="mono-inline">127.0.0.1:{b.port}</span>. Loopback only. A browser needs your approval here before it can read anything.</span> : <span>Not running. Another app may be using port <span className="mono-inline">{b.port}</span>. Quit it and restart APM.</span>}>
        <div className="bridge">
          <div className="bridge-node"><span className="bridge-ic"><A.Icon name="globe" size={16} /></span><b>APM for Chrome</b><span className="muted small">{seen ? (live ? "Active" : "Idle") : "Not connected"}</span></div>
          <div className={cx("bridge-wire", b.running && "is-live")}><i /><span className="mono-small">bearer token</span></div>
          <div className="bridge-node"><span className="bridge-ic is-app"><A.Mark size={18} /></span><b>APM</b><span className="muted small">{b.running ? <Status tone="success" pulse>Running</Status> : <Status tone="neutral">Stopped</Status>}</span></div>
          <div className={cx("bridge-wire", b.running && "is-live")}><i /><span className="mono-small">decrypts</span></div>
          <div className="bridge-node"><span className="bridge-ic"><A.Icon name="file-lock-2" size={16} /></span><b>vault.dat</b><span className="muted small">{all.length} passkeys</span></div>
        </div>
      </Card>
      <Card title="Connect a browser" description="No token to copy. The extension asks, and you confirm the code here.">
        {pair && <PendingPair key={pair.id} p={pair} />}
        <Steps items={[
          <span>Install <b>APM for Chrome</b> with the steps below.</span>,
          <span>Open it from the toolbar and choose <b>Connect</b>. It shows a 6 character code.</span>,
          <span>APM asks you to confirm. Check that the codes match, then choose <b>Connect</b>.</span>
        ]} />
      </Card>
      <Card title="Use it without the app" description="Link the browser once and the extension keeps working while APM is closed." cli="pm extension link"
        footer={<A.Button size="sm" variant="ghost" icon="timer" onClick={() => ui.go({ view: "settings", section: "sessions" })}>Auto-lock settings</A.Button>}>
        <Steps items={[
          <span>In a terminal, run <span className="mono-inline">pm extension link</span>. It registers pm with Chrome, Edge, Arc and Brave on this Mac.</span>,
          <span>If the extension isn't connected yet, it shows a code and pm asks you to confirm it. You do this once.</span>,
          <span>When this app is closed, the browser starts pm on its own. Unlock from the toolbar. The vault still locks on your Auto-lock settings.</span>
        ]} />
      </Card>
      <Card title="Manual pairing" description="If a browser cannot connect with a code, enter this token in the extension's options. Rotating it disconnects every browser until you connect it again."
        footer={<A.Button size="sm" icon="refresh-ccw" onClick={() => ui.open("confirm", { title: "Rotate the pairing token?", description: "Every browser using the old token is disconnected until you connect it again.", icon: "refresh-ccw", confirm: "Rotate token", onConfirm: async () => { const r = await act.bridgeRotate(); if (r.ok) ui.toast({ title: "Pairing token rotated" }); } })}>Rotate</A.Button>}>
        <div className="token-box"><Masked value={b.token} keep={6} /></div>
      </Card>
      <Card title="Install the extension" description="Chrome, Edge, Arc and Brave. Build it from the APM repository, then load it unpacked.">
        <Steps items={[
          <>In the APM repository, build the extension.<CodeBlock label="Terminal">cd extension && npm install && npm run build</CodeBlock></>,
          <span>Open <span className="mono-inline">chrome://extensions</span> and turn on <b>Developer mode</b>.</span>,
          <span>Choose <b>Load unpacked</b> and select the <span className="mono-inline">extension/dist</span> folder.</span>,
          <span>Pin <b>APM for Chrome</b> to the toolbar, then connect it above.</span>
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
