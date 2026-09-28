import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { titleOf } from "../lib/types.js";
import { ui } from "../lib/ui.js";
import { copied } from "./fields.jsx";
import { linkedLogin } from "./detail.jsx";
import { Cli } from "../ui/kit.jsx";

const cx = U.cx;

function useClock() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { let t; const tick = () => { setNow(Date.now()); t = setTimeout(tick, 200); }; tick(); return () => clearTimeout(t); }, []);
  return now;
}

function useCodes(list, now) {
  const step = Math.floor(now / 30000);
  const [codes, setCodes] = React.useState({});
  React.useEffect(() => {
    let live = true;
    Promise.all(list.map(async (i) => { const s = String(i.f.secret || "").replace(/\s/g, ""); try { return [i.id, await A.totp(s, 30, 6, now), await A.totp(s, 30, 6, now + 30000)]; } catch (e) { return [i.id, "", ""]; } }))
      .then((rows) => { if (live) setCodes(Object.fromEntries(rows.map(([id, c, n]) => [id, { c, n }]))); });
    return () => { live = false; };
  }, [step, list.map((i) => i.id + i.f.secret).join()]);
  return codes;
}

export function Authenticator() {
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const now = useClock();
  const [q, setQ] = React.useState("");
  const [drag, setDrag] = React.useState(null);
  const space = prefs.space ?? "all";
  const order = disk.totpOrder || [];
  let list = disk.items.filter((i) => i.type === "totp" && (space === "all" || (i.space || "") === space));
  list = list.slice().sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); if (ia >= 0 && ib >= 0) return ia - ib; if (ia >= 0) return -1; if (ib >= 0) return 1; return titleOf(a).localeCompare(titleOf(b)); });
  const shown = q ? list.filter((i) => (titleOf(i) + " " + (i.f.domain || "")).toLowerCase().includes(q.toLowerCase())) : list;
  const codes = useCodes(list, now);
  const remaining = 30 - ((now / 1000) % 30);
  const low = remaining <= 7;
  const clip = disk.settings.clipboard;
  const copy = (i) => { const c = codes[i.id] && codes[i.id].c; if (!c) return; copied("code for " + titleOf(i), c, true, clip); act.used(i.id); };
  React.useEffect(() => {
    const k = (e) => { if (ui.get().dialog || ui.get().cmd) return; if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; if (!e.metaKey && !e.ctrlKey && /^[1-9]$/.test(e.key)) { const i = shown[Number(e.key) - 1]; if (i) { e.preventDefault(); copy(i); } } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  const drop = (target) => { if (!drag || drag === target) return; const ids = list.map((i) => i.id); const from = ids.indexOf(drag); const to = ids.indexOf(target); ids.splice(to, 0, ids.splice(from, 1)[0]); act.totpOrder(ids); setDrag(null); };
  return (
    <div className="page page-wide">
      <div className="page-bar drag" />
      <div className="page-inner" style={{ maxWidth: 1040 }}>
        <header className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">Authenticator</h1>
            <p className="page-desc">{list.length} code{list.length === 1 ? "" : "s"}{space !== "all" ? " in " + (space || "Default") : ""}. Press <A.Kbd keys={["1"]} /> to <A.Kbd keys={["9"]} /> to copy by position, drag to reorder.</p>
            <div className="set-cli"><Cli cmd="pm totp" /></div>
          </div>
          <div className="page-actions">
            <A.SearchField placeholder="Filter codes" value={q} onChange={setQ} shortcut={null} size="sm" />
            <A.Button variant="primary" size="sm" icon="plus" onClick={() => ui.open("new", { type: "totp" })}>Add code</A.Button>
          </div>
        </header>
        <div className={cx("totp-clock", low && "is-low")}>
          <span className="totp-clock-label">{low ? "New codes in " : "Codes refresh in "}<b>{Math.ceil(remaining)}s</b></span>
          <div className="totp-clock-bar"><i style={{ transform: "scaleX(" + remaining / 30 + ")" }} /></div>
        </div>
        {shown.length === 0 ? (
          <A.EmptyState icon="timer" title={q ? "No codes match “" + q + "”" : "No authenticator codes yet"} action={!q && <A.Button variant="primary" size="sm" icon="plus" onClick={() => ui.open("new", { type: "totp" })}>Add code</A.Button>}>{q ? "Try the service name or website." : "Scan the QR code a site shows you with any authenticator, or paste its setup key or otpauth:// link here."}</A.EmptyState>
        ) : (
          <div className="totp-grid">
            {shown.map((i, ix) => {
              const c = codes[i.id] || {};
              const login = linkedLogin(disk, i);
              return (
                <div key={i.id} className={cx("totp-card", low && "is-low", drag === i.id && "is-drag")} draggable onDragStart={() => setDrag(i.id)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i.id)}>
                  <div className="totp-card-head">
                    <A.ItemIcon name={titleOf(i)} size="md" />
                    <div className="totp-card-name"><b>{titleOf(i)}</b><span>{i.f.domain || (login ? "Linked to " + titleOf(login) : "No website")}</span></div>
                    {ix < 9 && <span className="totp-num" aria-label={"Press " + (ix + 1) + " to copy"}>{ix + 1}</span>}
                    <A.Menu align="end" width={210} trigger={<A.IconButton icon="ellipsis" label="More" tip={false} size="xs" />} items={[
                      { label: "Copy code", icon: "copy", onSelect: () => copy(i) },
                      { label: "Open item", icon: "arrow-up-right", onSelect: () => { ui.go({ view: "vault", filter: "all" }); ui.select(i.id); } },
                      login ? { label: "Open " + titleOf(login) + " login", icon: "globe", onSelect: () => { ui.go({ view: "vault", filter: "all" }); ui.select(login.id); } } : null,
                      { label: "Edit", icon: "pencil", onSelect: () => { ui.go({ view: "vault", filter: "all" }); ui.select(i.id); ui.edit(i.id); } },
                      { separator: true },
                      { label: "Delete", icon: "trash-2", danger: true, onSelect: () => ui.open("delete", { ids: [i.id] }) }
                    ].filter(Boolean)} />
                  </div>
                  <button type="button" className="totp-code" onClick={() => copy(i)} aria-label={"Copy code for " + titleOf(i)}>
                    <span className="totp-digits" key={c.c}>{c.c ? c.c.slice(0, 3) + " " + c.c.slice(3) : "--- ---"}</span>
                    <span className="totp-copy"><A.Icon name="copy" size={14} />Copy</span>
                  </button>
                  <div className="totp-next"><span>Next</span><span className="mono">{c.n ? c.n.slice(0, 3) + " " + c.n.slice(3) : ""}</span></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
