import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { useNow } from "../settings/common.jsx";

const cx = U.cx;

export const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
export const pairTitle = (p) => "Connect " + (p.client || "a browser") + " to APM?";

export function PairCode({ code, size }) {
  const c = String(code || "");
  return (
    <div className={cx("pair-code", size && "is-" + size)} aria-label={"Code " + c.split("").join(" ")}>
      <span>{c.slice(0, 3)}</span><i aria-hidden="true">-</i><span>{c.slice(3, 6)}</span>
    </div>
  );
}

export function usePair(p) {
  const now = useNow(1000);
  const [busy, setBusy] = React.useState(null);
  const left = p && p.expires ? p.expires - now : null;
  const over = left != null && left <= 0;
  React.useEffect(() => { if (over && !busy) act.pairExpire(p.id); }, [p && p.id, over]);
  const respond = async (allow) => {
    if (!p || busy) return;
    setBusy(allow ? "allow" : "deny");
    await act.pairRespond(p.id, allow);
    setBusy(null);
  };
  return { left, busy, respond };
}

export function PairTimer({ left }) {
  if (left == null) return null;
  return <span className={cx("pair-ttl", left <= 15000 && "is-warning")}><A.Icon name="clock" size={13} />Expires in {clock(left)}</span>;
}

function PairDialog({ p }) {
  const { left, busy, respond } = usePair(p);
  return (
    <A.Dialog open onClose={() => respond(false)} size="sm" className="pair-dialog" bodyClassName="pair-body" title={pairTitle(p)}
      footerStart={<PairTimer left={left} />}
      footer={<><A.Button onClick={() => respond(false)} loading={busy === "deny"} disabled={!!busy}>Deny</A.Button><A.Button variant="primary" onClick={() => respond(true)} loading={busy === "allow"} disabled={!!busy}>Connect</A.Button></>}>
      <A.Mark tile size={48} />
      <div className="pair-head">
        <h2 className="pair-title">{pairTitle(p)}</h2>
        <p className="pair-sub">The APM extension wants to fill logins, codes and passkeys from this vault.</p>
      </div>
      <PairCode code={p.code} />
      <p className="pair-note"><A.Icon name="shield-check" size={14} />Check that the extension shows the same code. Only connect browsers you use.</p>
    </A.Dialog>
  );
}

export function PairHost() {
  const p = useStore((s) => s.pair);
  if (!p) return null;
  return <PairDialog key={p.id} p={p} />;
}
