import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { Card, Head, Masked, useNow } from "./common.jsx";

const cx = U.cx;
const LIVE_MS = 120000;
const activeFor = (ts, now) => { const a = U.ago(ts, now); return a === "now" ? "active now" : /^\d/.test(a) ? "active " + a + " ago" : "active " + a; };

export function Passkeys() {
  const disk = useStore((s) => s.disk);
  const b = disk.bridge;
  const now = useNow(15000);
  const seen = act.bridgeSeen();
  const live = !!(seen && now - seen.ts < LIVE_MS);
  React.useEffect(() => { act.bridgeInfo(); }, []);
  const passkeys = disk.items.reduce((n, it) => n + (it.passkeys || []).length, 0);
  return (
    <>
      <Head title="Browser extension" description="APM for Chrome fills logins, one-time codes and passkeys from this vault. It talks to this app over a loopback bridge, or to pm when the app is closed, and cannot decrypt anything on its own." />
      <Card title="Browser bridge"
        actions={seen ? <A.Status tone={live ? "success" : "neutral"} pulse={live}>{(seen.client || "A browser") + " · " + activeFor(seen.ts, now)}</A.Status> : <A.Status tone="neutral">No browser connected yet</A.Status>}
        footNote={b.running ? <span>Listening on <span className="mono-inline">127.0.0.1:{b.port}</span>. Loopback only. A browser needs your approval here before it can read anything.</span> : <span>Not running. Another app may be using port <span className="mono-inline">{b.port}</span>. Quit it and restart APM.</span>}>
        <div className="bridge">
          <div className="bridge-node"><span className="bridge-ic"><A.Icon name="globe" size={16} /></span><b>APM for Chrome</b><span className="muted small">{seen ? (live ? "Active" : "Idle") : "Not connected"}</span></div>
          <div className={cx("bridge-wire", b.running && "is-live")}><i /><span className="mono-small">bearer token</span></div>
          <div className="bridge-node"><span className="bridge-ic is-app"><A.Mark size={18} /></span><b>APM</b><span className="muted small">{b.running ? <A.Status tone="success" pulse>Running</A.Status> : <A.Status tone="neutral">Stopped</A.Status>}</span></div>
          <div className={cx("bridge-wire", b.running && "is-live")}><i /><span className="mono-small">decrypts</span></div>
          <div className="bridge-node"><span className="bridge-ic"><A.Icon name="file-lock-2" size={16} /></span><b>vault.dat</b><span className="muted small">{passkeys} passkeys</span></div>
        </div>
      </Card>
      <Card title="Use it without the app" description="Link the browser once and the extension keeps working while APM is closed." cli="pm extension link"
        footer={<A.Button size="sm" variant="ghost" icon="timer" onClick={() => ui.go({ view: "settings", section: "sessions" })}>Auto-lock settings</A.Button>}>
        <A.StepList items={[
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
        <A.StepList items={[
          <>In the APM repository, build the extension.<A.CodeBlock label="Terminal">cd extension && npm install && npm run build</A.CodeBlock></>,
          <span>Open <span className="mono-inline">chrome://extensions</span> and turn on <b>Developer mode</b>.</span>,
          <span>Choose <b>Load unpacked</b> and select the <span className="mono-inline">extension/dist</span> folder.</span>,
          <span>Pin <b>APM for Chrome</b> to the toolbar, open it and choose <b>Connect</b>. APM asks you to confirm the code it shows.</span>
        ]} />
      </Card>
    </>
  );
}
