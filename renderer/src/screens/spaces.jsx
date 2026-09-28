import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { ui } from "../lib/ui.js";

export const SPACE_COLORS = ["#8b8b94", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#71717a"];

export function SpaceDot({ color, size = 8 }) {
  return <i className="spacedot" style={{ width: size, height: size, background: SPACE_COLORS[color == null ? 7 : color] }} aria-hidden="true" />;
}

export function SpaceSwitcher() {
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const cur = prefs.space ?? "all";
  const count = (name) => disk.items.filter((i) => (i.space || "") === name).length;
  const label = cur === "all" ? "All spaces" : cur === "" ? "Default" : cur;
  const sp = disk.spaces.find((s) => s.name === cur);
  const items = [
    { section: "Spaces" },
    { label: "All spaces", icon: "layers", hint: String(disk.items.length), checked: undefined, onSelect: () => store.savePrefs({ space: "all" }) },
    { label: "Default", hint: String(count("")), onSelect: () => store.savePrefs({ space: "" }) },
    ...disk.spaces.map((s) => ({ label: s.name, hint: String(count(s.name)), onSelect: () => store.savePrefs({ space: s.name }) })),
    { separator: true },
    { label: "New space…", icon: "folder-plus", kbd: "⇧ ⌘ N", onSelect: () => ui.open("space-new") },
    { label: "Manage spaces…", icon: "settings", onSelect: () => ui.go({ view: "settings", section: "spaces" }) }
  ];
  return (
    <A.Menu width={232} items={items} trigger={
      <button type="button" className="space">
        <A.Mark tile size={28} />
        <span className="space-text">
          <span className="space-name">{disk.meta.name}</span>
          <span className="space-meta">{cur !== "all" && <SpaceDot color={sp ? sp.color : 7} size={6} />}{label} · {U.n(cur === "all" ? disk.items.length : count(cur), "item")}</span>
        </span>
        <A.Icon name="chevrons-up-down" size={14} />
      </button>
    } />
  );
}

export function SpaceNewDialog({ onClose }) {
  const [name, setName] = React.useState("");
  const [err, setErr] = React.useState(null);
  const go = async () => { const r = await act.addSpace(name); if (!r.ok) { setErr(r.error); return; } store.savePrefs({ space: r.space.name }); ui.toast({ title: "Created “" + r.space.name + "”", description: "Items you add now go into this space." }); onClose(); };
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="folder-plus" title="New space" description="A separate group of items inside this vault. Names must be unique." footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" onClick={go} disabled={!name.trim()}>Create space</A.Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); go(); }}><A.Input label="Name" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} placeholder="Family, Clients, Homelab" invalid={!!err} hint={err} autoFocus /></form>
    </A.Dialog>
  );
}

export function SpaceRenameDialog({ id, onClose }) {
  const disk = useStore((s) => s.disk);
  const sp = disk.spaces.find((s) => s.id === id);
  const [name, setName] = React.useState(sp ? sp.name : "");
  const [err, setErr] = React.useState(null);
  if (!sp) return null;
  const go = async () => { const old = sp.name; const r = await act.renameSpace(id, name); if (!r.ok) { setErr(r.error); return; } if (store.get().prefs.space === old) store.savePrefs({ space: name.trim() }); ui.toast({ title: "Renamed to “" + name.trim() + "”" }); onClose(); };
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="pencil" title={"Rename “" + sp.name + "”"} description="Items in this space move with it." footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" onClick={go} disabled={!name.trim() || name.trim() === sp.name}>Rename</A.Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); go(); }}><A.Input label="Name" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} invalid={!!err} hint={err} autoFocus /></form>
      <div className="stack-8"><span className="apm-label">Color</span><div className="colorpick">{SPACE_COLORS.slice(0, 7).map((c, i) => <button key={c} type="button" className={sp.color === i ? "is-on" : ""} style={{ background: c }} aria-label={"Color " + (i + 1)} onClick={() => act.spaceColor(id, i)} />)}</div></div>
    </A.Dialog>
  );
}

export function SpaceDeleteDialog({ id, onClose }) {
  const disk = useStore((s) => s.disk);
  const sp = disk.spaces.find((s) => s.id === id);
  const [dest, setDest] = React.useState("");
  if (!sp) return null;
  const n = disk.items.filter((i) => i.space === sp.name).length;
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="trash-2" tone="danger" title={"Delete “" + sp.name + "”?"} description={n ? "It has " + n + " item" + (n === 1 ? "" : "s") + ". Choose where they go. No items are deleted." : "It has no items."}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="danger" onClick={async () => { const name = sp.name; const r = await act.deleteSpace(id, dest); if (!r.ok) return; if (store.get().prefs.space === name) store.savePrefs({ space: "all" }); ui.toast({ title: "Deleted space “" + name + "”", description: n ? U.n(n, "item") + " moved to " + (dest || "Default") : null }); onClose(); }}>Delete space</A.Button></>}>
      {n > 0 && <A.Select label="Move its items to" value={dest} onChange={setDest} options={[{ value: "", label: "Default" }].concat(disk.spaces.filter((s) => s.id !== id).map((s) => ({ value: s.name, label: s.name })))} />}
    </A.Dialog>
  );
}

export function MoveDialog({ ids, onClose }) {
  const disk = useStore((s) => s.disk);
  const first = disk.items.find((i) => i.id === ids[0]);
  const [dest, setDest] = React.useState(first ? first.space || "" : "");
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="folder" title={ids.length === 1 ? "Move to space" : "Move " + ids.length + " items"} description="Spaces are folders inside this vault. Sync and AI access rules can target a space."
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" onClick={async () => { const r = await act.moveItems(ids, dest); if (r.ok) { ui.toast({ title: "Moved to " + (dest || "Default") }); ui.setMulti([]); } onClose(); }}>Move</A.Button></>}>
      <div className="choice-list tight">
        {[{ name: "", color: 7 }].concat(disk.spaces).map((s) => (
          <button key={s.name || "default"} type="button" className={U.cx("choice is-row", dest === s.name && "is-selected")} onClick={() => setDest(s.name)} aria-pressed={dest === s.name ? "true" : "false"}>
            <SpaceDot color={s.color} size={10} /><span className="choice-title">{s.name || "Default"}</span><span className="muted">{disk.items.filter((i) => (i.space || "") === s.name).length}</span>
            <span className="choice-radio">{dest === s.name && <A.Icon name="check" size={12} strokeWidth={2.75} />}</span>
          </button>
        ))}
      </div>
    </A.Dialog>
  );
}
