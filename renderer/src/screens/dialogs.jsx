import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { TYPES, CATEGORIES, getType, titleOf, activePolicy } from "../lib/types.js";
import { ui, useUi } from "../lib/ui.js";
import { DIALOGS, register } from "../lib/registry.js";
import { FieldEdit, parseOtpauth } from "./fields.jsx";
import { GeneratorDialog } from "./generator.jsx";
import { SpaceNewDialog, SpaceRenameDialog, SpaceDeleteDialog, MoveDialog } from "./spaces.jsx";
import { iconFor, useIcons } from "../lib/icons.js";
import "./transfer.jsx";

const cx = U.cx;

export function DialogHost() {
  const u = useUi();
  if (!u.dialog) return null;
  const C = DIALOGS[u.dialog.name];
  if (!C) return null;
  return <C key={u.dialog.key} {...u.dialog.props} onClose={() => ui.close()} />;
}

function NewItemDialog({ type: initial, onClose }) {
  const disk = useStore((s) => s.disk);
  const prefs = useStore((s) => s.prefs);
  const [type, setType] = React.useState(initial || null);
  const [q, setQ] = React.useState("");
  const [f, setF] = React.useState({});
  const [space, setSpace] = React.useState(prefs.space && prefs.space !== "all" ? prefs.space : "");
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const t = type && getType(type);
  React.useEffect(() => { if (t) { const init = {}; t.fields.forEach((x) => { if (x.kind === "select") init[x.key] = x.options[0]; if (x.key === "port") init.port = "22"; }); setF(init); } }, [type]);
  const shown = TYPES.filter((x) => !q || (x.label + " " + x.plural + " " + x.blurb).toLowerCase().includes(q.toLowerCase()));
  const save = async () => {
    if (busy) return;
    const miss = t.fields.find((x) => x.required && (f[x.key] == null || f[x.key] === "" || (Array.isArray(f[x.key]) && !f[x.key].length)));
    if (miss) { setErr("“" + miss.label + "” is required."); return; }
    const data = Object.assign({}, f);
    if (type === "totp") { const p = parseOtpauth(data.secret); if (p) { data.secret = p.secret; if (!data.account) data.account = p.account; } data.secret = String(data.secret).replace(/\s/g, "").toUpperCase(); if (!/^[A-Z2-7]+=*$/.test(data.secret)) { setErr("That setup key is not valid base32. It should only contain A to Z and 2 to 7."); return; } }
    const pol = activePolicy(disk);
    if (pol && pol.min_length && (type === "password" || type === "wifi") && data.password && data.password.length < pol.min_length) { setErr("Policy “" + pol.name + "” needs passwords of at least " + pol.min_length + " characters."); return; }
    setBusy(true);
    const r = await act.addItem({ type, f: data, space });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    ui.go({ view: "vault", filter: ui.get().route.filter === "trash" ? "all" : ui.get().route.filter });
    ui.select(r.item.id);
    ui.toast({ title: "Added " + titleOf(r.item), description: space ? "In " + space : null });
    onClose();
  };
  if (!t) {
    return (
      <A.Dialog open onClose={onClose} size="lg" title="New item" description="Choose what you are saving. Each type has its own fields." bodyClassName="picker-body">
        <A.SearchField placeholder="Search 25 types" value={q} onChange={setQ} shortcut={null} autoFocus data-autofocus />
        <div className="picker">
          {CATEGORIES.map((c) => { const list = shown.filter((x) => x.cat === c.id); if (!list.length) return null; return (
            <div key={c.id} className="picker-group">
              <div className="picker-label">{c.label}</div>
              <div className="picker-grid">{list.map((x) => <button key={x.id} type="button" className="picker-item" onClick={() => setType(x.id)}><A.ItemIcon icon={x.icon} size="md" /><span className="picker-text"><b>{x.label}</b><span>{x.blurb}</span></span></button>)}</div>
            </div>
          ); })}
          {!shown.length && <A.EmptyState icon="search" title={"No type matches “" + q + "”"}>Try Login, Card, SSH key or Note.</A.EmptyState>}
        </div>
      </A.Dialog>
    );
  }
  return (
    <A.Dialog open onClose={onClose} size="md" icon={t.icon} title={"New " + t.label.toLowerCase()} description={t.blurb}
      footerStart={initial ? null : <A.Button size="sm" variant="ghost" icon="arrow-left" onClick={() => { setType(null); setErr(null); }}>All types</A.Button>}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" kbd={["⌘", "↵"]} onClick={save} loading={busy}>Save {t.label.toLowerCase()}</A.Button></>}>
      <form className="edit-grid" onSubmit={(e) => { e.preventDefault(); save(); }} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); } }}>
        {t.fields.map((x, i) => <FieldEdit key={x.key} def={x} value={f[x.key]} autoFocus={i === 0} policy={activePolicy(disk)} onChange={(v) => { const n = { ...f, [x.key]: v }; if (type === "totp" && x.key === "secret") { const p = parseOtpauth(v); if (p) { n.secret = p.secret; if (!n.account) n.account = p.account; } } setF(n); setErr(null); }} />)}
        <A.Select label="Space" icon="layers" value={space} onChange={setSpace} options={[{ value: "", label: "Default" }].concat(disk.spaces.map((s) => ({ value: s.name, label: s.name })))} />
        {type === "document" && <A.Callout tone="warning" title="Delete the original yourself">APM encrypts a copy. The file you chose stays on disk until you remove it.</A.Callout>}
        {err && <div className="apm-hint apm-hint-danger apm-hint-enter" role="alert"><A.Icon name="triangle-alert" size={14} />{err}</div>}
      </form>
    </A.Dialog>
  );
}

function DeleteDialog({ ids, trash, onClose }) {
  const disk = useStore((s) => s.disk);
  useIcons();
  const src = trash ? disk.trash : disk.items;
  const list = src.filter((i) => ids.includes(i.id));
  const one = list.length === 1;
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    if (trash) { const r = await act.purge(ids); setBusy(false); if (r.ok) ui.toast({ title: one ? "Deleted " + titleOf(list[0]) + " permanently" : "Deleted " + list.length + " items permanently" }); onClose(); return; }
    const gone = await act.deleteItems(ids);
    setBusy(false);
    onClose();
    if (!gone.length) return;
    ui.setMulti([]); ui.select(null);
    ui.toast({ title: one ? "Moved " + titleOf(gone[0]) + " to Trash" : "Moved " + gone.length + " items to Trash", icon: "trash-2", tone: "neutral", duration: 5000, action: { label: "Undo", onClick: async () => { const back = await act.restoreItems(gone.map((g) => g.trashId).filter(Boolean)); if (back.length === 1) { const d = store.get().disk; const it = d && d.items.find((x) => x.type === back[0].type && titleOf(x) === titleOf(back[0]) && (x.space || "") === (back[0].space || "")); if (it) ui.select(it.id); } } } });
  };
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="trash-2" tone="danger" title={one ? "Delete “" + titleOf(list[0]) + "”?" : "Delete " + list.length + " items?"}
      description={trash ? "This removes " + (one ? "it" : "them") + " from the vault for good. Older snapshots in History still contain " + (one ? "it" : "them") + " until you prune." : (one ? "It moves" : "They move") + " to Trash. You can restore " + (one ? "it" : "them") + " until you empty Trash."}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="danger" onClick={go} loading={busy} data-autofocus>{trash ? "Delete permanently" : one ? "Delete item" : "Delete " + list.length + " items"}</A.Button></>}>
      {!one && <div className="mini-list">{list.slice(0, 5).map((i) => <div key={i.id} className="mini-row"><A.ItemIcon name={titleOf(i)} size="sm" icon={i.type === "password" ? undefined : getType(i.type).icon} src={iconFor(i)} /><span>{titleOf(i)}</span><span className="muted">{getType(i.type).label}</span></div>)}{list.length > 5 && <div className="mini-more">and {list.length - 5} more</div>}</div>}
      {one && list[0].passkeys && list[0].passkeys.length > 0 && <A.Callout tone="warning" title={"It has " + list[0].passkeys.length + " passkey" + (list[0].passkeys.length === 1 ? "" : "s")}>Deleting the item stops those passkeys from working in the browser extension.</A.Callout>}
    </A.Dialog>
  );
}

function ConfirmDialog({ title, description, icon, tone, confirm, onConfirm, onClose, word, children }) {
  const [typed, setTyped] = React.useState("");
  return (
    <A.Dialog open onClose={onClose} size="sm" icon={icon} tone={tone} title={title} description={description}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant={tone === "danger" ? "danger" : "primary"} disabled={word && typed !== word} onClick={() => { onConfirm && onConfirm(); onClose(); }} data-autofocus={word ? undefined : true}>{confirm || "Confirm"}</A.Button></>}>
      {children}
      {word && <A.Input label={<span>Type <b className="mono-inline">{word}</b> to confirm</span>} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />}
    </A.Dialog>
  );
}

const SHORTCUTS = [
  ["Vault", [["⌘ K", "Search items, actions and settings"], ["⌘ F", "Search the list"], ["⌘ N", "New item"], ["⇧ ⌘ N", "New space"], ["⌘ G", "Password generator"], ["⌘ 1 to 9", "All, Logins, Authenticator, Tokens, API keys, SSH, Notes, Cloud, Banking"], ["⌥ ⌘ 1 to 5", "Vault, Authenticator, Watchtower, History, Settings"]]],
  ["Selected item", [["⇧ ⌘ C", "Copy the main secret"], ["⇧ ⌘ U", "Copy username"], ["⇧ ⌘ T", "Copy one-time code"], ["⇧ ⌘ O", "Open website"], ["⌘ E", "Edit"], ["⌘ S", "Save while editing"], ["⌘ ⌫", "Delete"], ["Space", "Quick look"]]],
  ["List", [["↑ ↓", "Previous or next item"], ["⇧ ↑ ↓", "Extend the selection"], ["⌘ click", "Add to selection"], ["⌘ A", "Select all"], ["Esc", "Clear selection or search"]]],
  ["App", [["⌘ Z", "Undo last change"], ["⌘ L", "Lock vault"], ["⇧ ⌘ B", "Toggle sidebar"], ["⌘ ,", "Settings"], ["⌘ /", "This list"]]]
];
function ShortcutsDialog({ onClose }) {
  return (
    <A.Dialog open onClose={onClose} size="lg" icon="keyboard" title="Keyboard shortcuts" description="Every action in APM has a key. The command menu finds the rest.">
      <div className="shortcuts">
        {SHORTCUTS.map(([g, rows]) => (
          <div key={g} className="shortcuts-group">
            <div className="shortcuts-h">{g}</div>
            {rows.map(([k, l]) => <div key={k + l} className="shortcut"><span>{l}</span><A.Kbd keys={k.split(" ")} /></div>)}
          </div>
        ))}
      </div>
    </A.Dialog>
  );
}

function NoteEditor({ id, onClose }) {
  const disk = useStore((s) => s.disk);
  const [curId, setCurId] = React.useState(id);
  const u = useUi();
  React.useEffect(() => { if (u.selected && u.selected !== curId && !disk.items.find((i) => i.id === curId)) setCurId(u.selected); }, [u.selected, disk]);
  const it = disk.items.find((i) => i.id === curId);
  const [v, setV] = React.useState(it ? it.f.content || "" : "");
  const [saved, setSaved] = React.useState(it ? it.f.content || "" : "");
  const ta = React.useRef(null);
  const [pos, setPos] = React.useState({ line: 1, col: 1 });
  const [asking, setAsking] = React.useState(false);
  if (!it) return null;
  const dirty = v !== saved;
  const save = async () => { const r = await act.updateItem(it.id, { f: { content: v } }, "Edited note " + titleOf(it)); if (r.ok) { setSaved(v); ui.toast({ title: "Note saved" }); } };
  const caret = () => { const el = ta.current; if (!el) return; const before = el.value.slice(0, el.selectionStart); const lines = before.split("\n"); setPos({ line: lines.length, col: lines[lines.length - 1].length + 1 }); };
  const close = () => { if (dirty) setAsking(true); else onClose(); };
  const lines = v.split("\n").length;
  return (
    <A.Dialog open onClose={close} size="xl" className="note-dialog" title={titleOf(it)} description={(it.space || "Default") + " · Secure note"} icon="sticky-note"
      footerStart={<span className="mono-small">Ln {pos.line}, Col {pos.col} · {lines} lines · {v.split(/\s+/).filter(Boolean).length} words · {v.length} chars · <span className={dirty ? "dirty" : "clean"}>{dirty ? "● modified" : "● saved"}</span></span>}
      footer={<><A.Button onClick={close}>Close</A.Button><A.Button variant="primary" kbd={["⌘", "S"]} disabled={!dirty} onClick={save}>Save</A.Button></>}>
      {asking && <A.Callout tone="warning" title="You have unsaved changes" action={<><A.Button size="sm" onClick={() => setAsking(false)}>Keep editing</A.Button><A.Button size="sm" variant="danger" onClick={onClose}>Discard</A.Button></>}>Close without saving?</A.Callout>}
      <div className="note-editor">
        <div className="note-gutter" aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i} className={i + 1 === pos.line ? "is-cur" : ""}>{i + 1}</span>)}</div>
        <textarea ref={ta} className="note-area" value={v} onChange={(e) => { setV(e.target.value); caret(); }} onKeyUp={caret} onClick={caret} spellCheck autoFocus
          onScroll={(e) => { const g = e.target.previousSibling; if (g) g.scrollTop = e.target.scrollTop; }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } if (e.key === "Tab") { e.preventDefault(); const el = e.target; const s = el.selectionStart; const n = v.slice(0, s) + "  " + v.slice(el.selectionEnd); setV(n); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); } }} aria-label="Note" />
      </div>
    </A.Dialog>
  );
}

register("new", NewItemDialog);
register("delete", DeleteDialog);
register("confirm", ConfirmDialog);
register("shortcuts", ShortcutsDialog);
register("note", NoteEditor);
register("generator", GeneratorDialog);
register("space-new", SpaceNewDialog);
register("space-rename", SpaceRenameDialog);
register("space-delete", SpaceDeleteDialog);
register("move", MoveDialog);
