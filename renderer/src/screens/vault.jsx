import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { getType, titleOf, subOf, TYPES } from "../lib/types.js";
import { ui, useUi } from "../lib/ui.js";
import { Detail, itemMenu, SpaceChip } from "./detail.jsx";

const cx = U.cx;
const SORTS = [{ value: "recent", label: "Last used" }, { value: "name", label: "Name" }, { value: "added", label: "Date added" }, { value: "type", label: "Type" }];

export function filterLabel(filter, disk) {
  if (filter === "all") return "All items";
  if (filter === "fav") return "Favorites";
  if (filter === "trash") return "Trash";
  if (filter.startsWith("type:")) return getType(filter.slice(5)).plural;
  return "All items";
}

export function visibleItems(disk, prefs, filter, query) {
  const space = prefs.space ?? "all";
  let list = filter === "trash" ? disk.trash : disk.items;
  if (space !== "all") list = list.filter((i) => (i.space || "") === space);
  if (filter === "fav") list = list.filter((i) => i.fav);
  if (filter.startsWith("type:")) { const ty = filter.slice(5); list = list.filter((i) => i.type === ty); }
  const q = String(query || "").trim().toLowerCase();
  if (q) {
    const rank = (i) => { const n = titleOf(i).toLowerCase(); const hay = (n + " " + subOf(i) + " " + getType(i.type).label + " " + (i.f.website || "") + " " + (i.f.service || "") + " " + (i.space || "")).toLowerCase(); if (n === q) return 4; if (n.startsWith(q)) return 3; if (hay.includes(q)) return 2; let j = 0; for (const c of n) { if (c === q[j]) j++; if (j === q.length) return 1; } return 0; };
    list = list.map((i) => ({ i, r: rank(i) })).filter((x) => x.r > 0).sort((a, b) => b.r - a.r).map((x) => x.i);
    return list;
  }
  const sort = prefs.sort || "recent";
  const by = { recent: (a, b) => (b.used || 0) - (a.used || 0), name: (a, b) => titleOf(a).localeCompare(titleOf(b)), added: (a, b) => b.created - a.created, type: (a, b) => getType(a.type).label.localeCompare(getType(b.type).label) || titleOf(a).localeCompare(titleOf(b)) };
  if (filter === "trash") return list.slice().sort((a, b) => b.deletedAt - a.deletedAt);
  return list.slice().sort(by[sort] || by.recent);
}

function groupsOf(list, prefs, query, filter) {
  if (query) return [{ label: "Best matches", rows: list }];
  if (filter === "trash") return [{ label: "Deleted items", rows: list }];
  const sort = prefs.sort || "recent";
  const out = []; const idx = {};
  const key = (i) => sort === "name" ? (titleOf(i)[0] || "#").toUpperCase().replace(/[^A-Z]/, "#") : sort === "type" ? getType(i.type).plural : U.group(sort === "added" ? i.created : i.used);
  list.forEach((i) => { const k = key(i); if (idx[k] == null) { idx[k] = out.length; out.push({ label: k, rows: [] }); } out[idx[k]].rows.push(i); });
  return out;
}

export function Vault({ analysis }) {
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const session = useStore((s) => s.session);
  const u = useUi();
  const filter = u.route.filter || "all";
  const list = visibleItems(disk, prefs, filter, u.query);
  const groups = groupsOf(list, prefs, u.query, filter);
  const flat = groups.flatMap((g) => g.rows);
  const src = filter === "trash" ? disk.trash : disk.items;
  let current = src.find((i) => i.id === u.selected);
  if (!current && !u.query && flat.length && u.multi.length < 2) current = flat[0];
  const searchRef = React.useRef(null);
  const [ctx, setCtx] = React.useState(null);
  const anchor = React.useRef(null);
  const hover = React.useRef(null);
  const warn = analysis.reusedIds;

  React.useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target !== searchRef.current;
      if (u.dialog || u.cmd || u.editing) return;
      if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); searchRef.current && searchRef.current.focus(); return; }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp" || (mod && (e.key === "ArrowDown" || e.key === "ArrowUp"))) && !typing) {
        e.preventDefault();
        const i = flat.findIndex((x) => current && x.id === current.id);
        const n = flat[U.clamp(i + (e.key === "ArrowDown" ? 1 : -1), 0, flat.length - 1)];
        hover.current = null;
        if (n) { if (u.quick && !e.shiftKey) ui.quick(n.id); if (e.shiftKey) { const m = new Set(u.multi.length ? u.multi : current ? [current.id] : []); m.add(n.id); ui.setMulti(Array.from(m)); } else ui.setMulti([]); ui.select(n.id); const el = document.querySelector('[data-row="' + n.id + '"]'); el && el.scrollIntoView({ block: "nearest" }); }
        return;
      }
      if (typing) return;
      if (e.key === " " && !mod && filter !== "trash") { const h = hover.current && flat.find((x) => x.id === hover.current); const q = u.quick ? null : (h || current); if (u.quick || q) { e.preventDefault(); ui.quick(q ? q.id : null); } return; }
      if (!current) return;
      if (e.key === "Enter" && !mod && e.target === searchRef.current && current) { e.preventDefault(); const b = document.querySelector(".detail .apm-sf-value"); b && b.focus(); return; }
      if (mod && e.key === "Backspace") { e.preventDefault(); ui.open("delete", { ids: u.multi.length > 1 ? u.multi : [current.id], trash: filter === "trash" }); return; }
      if (mod && e.key.toLowerCase() === "e" && filter !== "trash") { e.preventDefault(); if (!session.readonly) ui.edit(current.id); return; }
      if (mod && e.key.toLowerCase() === "a" && !typing) { e.preventDefault(); ui.setMulti(flat.map((x) => x.id)); return; }
      if (e.key === "Escape" && u.multi.length) { ui.setMulti([]); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const click = (e, it) => {
    if (e.metaKey || e.ctrlKey) { const m = new Set(u.multi.length ? u.multi : current ? [current.id] : []); m.has(it.id) ? m.delete(it.id) : m.add(it.id); ui.setMulti(Array.from(m)); ui.select(it.id); return; }
    if (e.shiftKey && current) { const a = flat.findIndex((x) => x.id === current.id); const b = flat.findIndex((x) => x.id === it.id); const [lo, hi] = a < b ? [a, b] : [b, a]; ui.setMulti(flat.slice(lo, hi + 1).map((x) => x.id)); return; }
    ui.setMulti([]); ui.select(it.id);
  };

  const sortMenu = SORTS.map((s) => ({ label: s.label, checked: (prefs.sort || "recent") === s.value, onSelect: () => store.savePrefs({ sort: s.value }) }));
  const ro = session.readonly;
  const multi = u.multi.length > 1 ? u.multi : [];

  return (
    <>
      <section className="list" aria-label="Items">
        <div className="list-head drag">
          <div className="list-title"><h1>{filterLabel(filter, disk)}</h1><span>{list.length}</span></div>
          <div className="nodrag list-actions">
            {filter === "trash" ? (
              <A.Button size="sm" variant="ghost" icon="trash-2" disabled={!disk.trash.length} onClick={() => ui.open("confirm", { title: "Empty Trash?", description: disk.trash.length + " item" + (disk.trash.length === 1 ? "" : "s") + " will be deleted permanently. History still holds older vault snapshots until you prune them.", icon: "trash-2", tone: "danger", confirm: "Empty Trash", onConfirm: async () => { const n = await act.emptyTrash(); if (n) ui.toast({ title: "Deleted " + n + " item" + (n === 1 ? "" : "s") + " permanently" }); } })}>Empty</A.Button>
            ) : <>
              <A.Menu align="end" width={200} items={[{ section: "Sort by" }].concat(sortMenu)} trigger={<A.IconButton icon="arrow-up-down" label={"Sort: " + SORTS.find((s) => s.value === (prefs.sort || "recent")).label} tip={false} />} />
              <A.Button variant="primary" size="sm" icon="plus" onClick={() => ui.open("new", { type: filter.startsWith("type:") ? filter.slice(5) : null })} disabled={ro}>New</A.Button>
            </>}
          </div>
        </div>
        <div className="list-search">
          <A.SearchField ref={searchRef} value={u.query} onChange={(v) => { ui.query(v); }} placeholder={"Search " + (filter === "all" ? "" : filterLabel(filter, disk).toLowerCase() + ", ") + U.n(list.length, "item")} shortcut={["⌘", "F"]} />
        </div>
        {multi.length > 0 && (
          <div className="bulkbar">
            <span><b>{multi.length}</b> selected</span>
            <button type="button" className="linkbtn" onClick={() => ui.setMulti([])}>Clear</button>
          </div>
        )}
        <div className="list-scroll" role="listbox" aria-label={filterLabel(filter, disk)} aria-multiselectable="true">
          {groups.length === 0 && (
            u.query ? <A.EmptyState icon="search" title={"No matches for “" + u.query + "”"} action={<A.Button size="sm" onClick={() => ui.query("")}>Clear search</A.Button>}>Search looks at names, usernames, websites, types and spaces.</A.EmptyState>
            : filter === "fav" ? <A.EmptyState icon="star" title="No favorites yet">Star an item to pin it here and to the top of the command menu.</A.EmptyState>
            : filter === "trash" ? <A.EmptyState icon="trash-2" title="Trash is empty">Deleted items wait here until you empty it.</A.EmptyState>
            : <A.EmptyState icon={filter.startsWith("type:") ? getType(filter.slice(5)).icon : "layers"} title={filter === "all" ? (prefs.space !== "all" ? "Nothing in " + (prefs.space || "Default") + " yet" : "Your vault is empty") : "No " + filterLabel(filter, disk).toLowerCase() + (prefs.space !== "all" ? " in " + (prefs.space || "Default") : "")} action={!ro && <A.Button size="sm" variant="primary" icon="plus" onClick={() => ui.open("new", { type: filter.startsWith("type:") ? filter.slice(5) : null })}>New {filter.startsWith("type:") ? getType(filter.slice(5)).label.toLowerCase() : "item"}</A.Button>}>{filter.startsWith("type:") ? getType(filter.slice(5)).blurb : "Everything you save shows up here."}</A.EmptyState>
          )}
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <div className="list-group"><span>{g.label}</span><span>{g.rows.length}</span></div>
              <div className="list-rows">
                {g.rows.map((it, ix) => {
                  const sel = multi.includes(it.id);
                  const act2 = current && current.id === it.id && !multi.length;
                  const issue = analysis.issues.find((x) => x.item.id === it.id);
                  return (
                    <div key={it.id} data-row={it.id} className={cx("rowwrap", sel && "is-multi")} style={{ animationDelay: Math.min(ix, 10) * 16 + "ms" }}
                      onMouseEnter={() => { hover.current = it.id; }} onMouseMove={() => { hover.current = it.id; }} onMouseLeave={() => { if (hover.current === it.id) hover.current = null; }}
                      onClickCapture={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) { e.stopPropagation(); e.preventDefault(); click(e, it); } }}
                      onContextMenu={(e) => { e.preventDefault(); if (!sel) { ui.setMulti([]); ui.select(it.id); } setCtx({ x: e.clientX, y: e.clientY, it }); }}
                      onDoubleClick={() => filter !== "trash" && !ro && ui.edit(it.id)}>
                      <A.ItemRow title={titleOf(it)} subtitle={filter === "trash" ? "Deleted " + U.agoLong(it.deletedAt) : subOf(it)} mono={["ssh_key", "ssh_config", "apikey", "cloud", "k8s"].includes(it.type)} time={U.ago(filter === "trash" ? it.deletedAt : it.used)} favorite={it.fav} alert={issue ? (issue.tone === "danger" ? "danger" : "warning") : null} active={act2 || sel} icon={it.type === "password" ? undefined : getType(it.type).icon} onClick={(e) => click(e, it)} />
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
        {ctx && <ContextMenu x={ctx.x} y={ctx.y} onClose={() => setCtx(null)} items={filter === "trash" ? [{ label: "Restore", icon: "rotate-ccw", onSelect: async () => { const b = await act.restoreItems([ctx.it.id]); if (b.length) ui.toast({ title: "Restored " + titleOf(ctx.it) }); } }, { separator: true }, { label: "Delete permanently", icon: "trash-2", danger: true, onSelect: () => ui.open("delete", { ids: [ctx.it.id], trash: true }) }] : multi.length > 1 ? bulkMenu(multi) : itemMenu(ctx.it, disk)} />}
      </section>
      {multi.length > 1 ? <Bulk ids={multi} disk={disk} /> : current ? (filter === "trash" ? <TrashDetail it={current} /> : <Detail item={current} analysis={analysis} />) : <section className="detail"><div className="detail-bar drag" /><A.EmptyState icon="mouse-pointer-click" title="Nothing selected">Choose an item on the left, or press <A.Kbd keys={["⌘", "K"]} /> to jump to one.</A.EmptyState></section>}
    </>
  );
}

function bulkMenu(ids) {
  return [
    { label: "Add to favorites", icon: "star", onSelect: async () => { const r = await act.favItems(ids, true); if (r.ok) ui.toast({ title: "Starred " + ids.length + " items" }); } },
    { label: "Move to space…", icon: "folder", onSelect: () => ui.open("move", { ids }) },
    { label: "Export selected…", icon: "file-down", onSelect: () => ui.open("export", { ids }) },
    { separator: true },
    { label: "Delete " + ids.length + " items", icon: "trash-2", danger: true, onSelect: () => ui.open("delete", { ids }) }
  ];
}

export function ContextMenu({ x, y, items, onClose }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ left: x, top: y });
  React.useLayoutEffect(() => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); setPos({ left: Math.min(x, window.innerWidth - r.width - 8), top: Math.min(y, window.innerHeight - r.height - 8) }); }, []);
  React.useEffect(() => { const d = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }; setTimeout(() => document.addEventListener("mousedown", d), 0); window.addEventListener("keydown", k, true); return () => { document.removeEventListener("mousedown", d); window.removeEventListener("keydown", k, true); }; }, []);
  return ReactDOM.createPortal(<div ref={ref} className="ctxmenu" style={pos}><A.MenuList items={items} autoFocus onSelect={onClose} label="Item actions" /></div>, document.body);
}

function Bulk({ ids, disk }) {
  const items = disk.items.filter((i) => ids.includes(i.id));
  const types = {}; items.forEach((i) => { types[i.type] = (types[i.type] || 0) + 1; });
  return (
    <section className="detail">
      <div className="detail-bar drag" />
      <div className="bulk">
        <div className="bulk-stack" aria-hidden="true">{items.slice(0, 4).map((i, k) => <span key={i.id} style={{ transform: "translate(" + k * 10 + "px," + k * -6 + "px) rotate(" + (k * 3 - 4) + "deg)", zIndex: 4 - k }}><A.ItemIcon name={titleOf(i)} size="lg" icon={i.type === "password" ? undefined : getType(i.type).icon} /></span>)}</div>
        <h2 className="title-2">{ids.length} items selected</h2>
        <p className="muted">{Object.entries(types).map(([t, n]) => n + " " + (n === 1 ? getType(t).label.toLowerCase() : getType(t).plural.toLowerCase())).join(", ")}</p>
        <div className="bulk-actions">
          <A.Button icon="star" onClick={async () => { const r = await act.favItems(ids, true); if (r.ok) ui.toast({ title: "Starred " + ids.length + " items" }); }}>Favorite</A.Button>
          <A.Button icon="folder" onClick={() => ui.open("move", { ids })}>Move</A.Button>
          <A.Button icon="file-down" onClick={() => ui.open("export", { ids })}>Export</A.Button>
          <A.Button variant="danger" icon="trash-2" onClick={() => ui.open("delete", { ids })}>Delete</A.Button>
        </div>
        <p className="help">Hold <A.Kbd keys={["⌘"]} /> to add or remove items, <A.Kbd keys={["⇧"]} /> to select a range. <A.Kbd keys={["Esc"]} /> clears.</p>
      </div>
    </section>
  );
}

function TrashDetail({ it }) {
  const disk = useStore((s) => s.disk);
  const t = getType(it.type);
  return (
    <section className="detail">
      <div className="detail-bar drag">
        <div className="crumbs nodrag"><A.Icon name="trash-2" size={14} /><b>Trash</b><A.Icon name="chevron-right" size={12} /><span className="crumb-cur">{titleOf(it)}</span></div>
        <div className="detail-actions trash-actions nodrag">
          <A.Button size="sm" variant="secondary" icon="rotate-ccw" onClick={async () => { const b = await act.restoreItems([it.id]); if (b.length) ui.toast({ title: "Restored " + titleOf(it) }); }}>Restore</A.Button>
          <A.Button size="sm" variant="secondary" className="is-destructive" icon="trash-2" onClick={() => ui.open("delete", { ids: [it.id], trash: true })}>Delete</A.Button>
        </div>
      </div>
      <div className="detail-scroll"><div className="detail-body">
        <div className="hero"><A.ItemIcon name={titleOf(it)} size="lg" icon={it.type === "password" ? undefined : t.icon} /><div className="hero-text"><h2 className="title-1 hero-title">{titleOf(it)}</h2><div className="hero-badges"><A.Badge icon={t.icon}>{t.label}</A.Badge><SpaceChip name={it.space} disk={disk} /><A.Badge tone="danger" icon="trash-2">Deleted {U.agoLong(it.deletedAt)}</A.Badge></div></div></div>
        <A.Callout tone="neutral" title="This item is in Trash">It is kept inside the encrypted vault, and syncs with it, until you empty Trash. pm does not show it. Restore puts it back where it was.</A.Callout>
      </div></div>
    </section>
  );
}

export function TypeNav({ filter, disk, space, onPick, collapsed, onToggle }) {
  const within = (i) => space === "all" || (i.space || "") === space;
  const counts = {}; disk.items.filter(within).forEach((i) => { counts[i.type] = (counts[i.type] || 0) + 1; });
  const present = TYPES.filter((t) => counts[t.id]);
  const shown = collapsed ? present.slice(0, 9) : TYPES;
  return (
    <>
      <div className="side-label overline"><span>Types</span></div>
      <nav className="side-group" aria-label="Types">
        {shown.map((t) => <A.NavItem key={t.id} icon={t.icon} label={t.plural} count={counts[t.id] || 0} active={filter === "type:" + t.id} onClick={() => onPick("type:" + t.id)} className={!counts[t.id] ? "is-empty" : undefined} />)}
        <A.NavItem icon={collapsed ? "chevron-down" : "chevron-up"} label={collapsed ? (TYPES.length - shown.length) + " more types" : "Show fewer"} className="side-more" onClick={onToggle} />
      </nav>
    </>
  );
}
