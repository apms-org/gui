import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, store } from "../lib/store.js";
import { TYPES, CATEGORIES, getType, titleOf, EXPORTABLE, activePolicy } from "../lib/types.js";
import { ui, useUi } from "../lib/ui.js";
import { DIALOGS, register } from "../lib/registry.js";
import { FieldEdit, parseOtpauth } from "./fields.jsx";
import { GeneratorDialog } from "./generator.jsx";
import { SpaceNewDialog, SpaceRenameDialog, SpaceDeleteDialog, MoveDialog } from "./spaces.jsx";

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
      {!one && <div className="mini-list">{list.slice(0, 5).map((i) => <div key={i.id} className="mini-row"><A.ItemIcon name={titleOf(i)} size="sm" icon={i.type === "password" ? undefined : getType(i.type).icon} /><span>{titleOf(i)}</span><span className="muted">{getType(i.type).label}</span></div>)}{list.length > 5 && <div className="mini-more">and {list.length - 5} more</div>}</div>}
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

function detectFormat(name, text) {
  if (/\.json$/i.test(name)) return "json";
  if (/\.csv$/i.test(name)) return "csv";
  if (/otpauth:\/\//.test(text)) return "txt";
  return /\.txt$/i.test(name) ? "txt" : "csv";
}
function parseImport(name, text) {
  const fmt = detectFormat(name, text);
  const out = [];
  if (fmt === "json") {
    let data; try { data = JSON.parse(text); } catch (e) { return { fmt, error: "This file is not valid JSON. If it is an encrypted APM export, enter its password first." }; }
    const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { const name2 = o.account || o.name || o.label || o.title; const pw = o.password || o.pass; const sec = o.secret || o.totp; if (name2 && pw) out.push({ type: "password", f: { account: String(name2), username: String(o.username || o.user || o.login || ""), password: String(pw), website: String(o.url || o.website || "") } }); else if (name2 && sec && /^[A-Z2-7=\s]+$/i.test(sec)) out.push({ type: "totp", f: { account: String(name2), secret: String(sec).replace(/\s/g, "").toUpperCase() } }); Object.values(o).forEach((v) => { if (typeof v === "string" && /^otpauth:/.test(v)) { const p = parseOtpauth(v); if (p) out.push({ type: "totp", f: { account: p.account, secret: p.secret } }); } else if (v && typeof v === "object") walk(v); }); } };
    walk(data);
    const native = !!(data && typeof data === "object" && ["entries", "totp_entries", "secure_notes", "api_keys", "ssh_keys", "wifi_credentials", "recovery_codes", "tokens"].some((k) => Array.isArray(data[k])));
    if (native) return { fmt, native, items: out.filter((x) => x.f.account) };
  } else if (fmt === "csv") {
    const rows = text.split(/\r?\n/).filter(Boolean).map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "").trim()));
    const head = rows[0].map((h) => h.toLowerCase());
    const has = (k) => head.findIndex((h) => h === k || h.includes(k));
    const iName = Math.max(has("account"), has("name"), has("title")); const iUser = Math.max(has("username"), has("login"), has("user")); const iPw = has("password"); const iUrl = Math.max(has("url"), has("website")); const iSec = has("secret"); const iType = has("type");
    const body = iPw >= 0 || iSec >= 0 ? rows.slice(1) : rows;
    body.forEach((r) => { const type = iType >= 0 ? String(r[iType]).toUpperCase() : ""; if (type === "TOTP" || (iSec >= 0 && r[iSec] && !(iPw >= 0 && r[iPw]))) out.push({ type: "totp", f: { account: r[iName >= 0 ? iName : 0], secret: String(r[iSec >= 0 ? iSec : 2] || "").toUpperCase() } }); else if (r[iPw >= 0 ? iPw : 3]) out.push({ type: "password", f: { account: r[iName >= 0 ? iName : 1], username: r[iUser >= 0 ? iUser : 2] || "", password: r[iPw >= 0 ? iPw : 3], website: iUrl >= 0 ? r[iUrl] : "" } }); });
  } else {
    text.split(/\r?\n/).forEach((l) => { const p = parseOtpauth(l.trim()); if (p) out.push({ type: "totp", f: { account: p.account, secret: p.secret } }); });
  }
  return { fmt, items: out.filter((x) => x.f.account) };
}

function ImportDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const [file, setFile] = React.useState(null);
  const [res, setRes] = React.useState(null);
  const [pick, setPick] = React.useState([]);
  const [space, setSpace] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const parse = (name, text, path) => { const p = parseImport(name, text); setFile({ name, size: text.length, path }); setRes(p); setPick((p.items || []).map((_, i) => i)); setErr(null); };
  const browse = async () => {
    const paths = await window.apm.dialog.open({ title: "Choose an export file", filters: [{ name: "Exports", extensions: ["json", "csv", "txt"] }, { name: "All files", extensions: ["*"] }] });
    if (!paths || !paths[0]) return;
    try { const f = await window.apm.files.read(paths[0]); const text = decodeB64(f.data); parse(f.name, text, paths[0]); } catch (e) { setErr((e && e.message) || "Could not read that file."); }
  };
  const drop = (e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => parse(f.name, String(r.result), null); r.readAsText(f); };
  const encrypted = !!(res && res.error);
  const dupes = res && res.items ? res.items.map((x) => disk.items.some((i) => i.type === x.type && (i.space || "") === space && titleOf(i).toLowerCase() === String(x.f.account || "").toLowerCase())) : [];
  const go = async () => {
    setBusy(true); setErr(null);
    if (encrypted || (res.native && file.path)) {
      const r = await act.importData({ format: res.fmt, path: file.path, password: encrypted ? pw : "" });
      setBusy(false);
      if (!r.ok) { setErr(r.code === "wrong_password" ? "That password does not open this export." : r.error); return; }
      ui.toast({ title: "Imported " + (r.count || 0) + " item" + (r.count === 1 ? "" : "s"), description: "From " + file.name });
      onClose(); return;
    }
    const list = res.items.filter((_, i) => pick.includes(i)).map((x) => Object.assign({}, x, { space }));
    const r = await act.importItems(list);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    const added = r.added != null ? r.added : list.length;
    ui.toast({ title: "Imported " + added + " item" + (added === 1 ? "" : "s"), description: r.skipped ? r.skipped + " already in the vault were skipped" : "From " + file.name });
    onClose();
  };
  const ready = encrypted ? !!(file && file.path && pw) : res && res.native && file && file.path ? true : !!(res && res.items && pick.length);
  return (
    <A.Dialog open onClose={onClose} size="lg" icon="download" title="Import items" description="APM reads its own exports, and logins and authenticator codes from other managers and browsers."
      footerStart={res && res.items ? <span>{pick.length} of {res.items.length} selected{dupes.filter(Boolean).length ? " · " + dupes.filter(Boolean).length + " already in your vault" : ""}</span> : <span>Supports .json (plain or encrypted), .csv and .txt with otpauth:// links</span>}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={!ready} onClick={go}>{encrypted ? "Decrypt and import" : res && res.native && file && file.path ? "Import APM export" : "Import " + (pick.length || "") + " item" + (pick.length === 1 ? "" : "s")}</A.Button></>}>
      <div className={cx("filedrop", over && "is-over", file && "has-file")} role="button" tabIndex={0} onClick={browse} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); browse(); } }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
        <span className="filedrop-icon"><A.Icon name={file ? "file" : "upload"} size={18} /></span>
        <span className="filedrop-text"><b>{file ? file.name : "Drop an export file here or choose one"}</b><span>{file ? U.bytes(file.size) + " · click to choose another" : "Chrome, Safari, Firefox, Bitwarden, 1Password CSV, or an APM export"}</span></span>
      </div>
      {encrypted && (file.path ? <A.Input label="Export password" type="password" icon="key-round" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus hint="This looks like an encrypted APM export. Enter the password chosen when it was exported." />
        : <A.Callout tone="accent" title="Choose this file with the button instead">Encrypted exports are decrypted by pm, which needs the file's location. Click the box above to choose it.</A.Callout>)}
      {res && res.items && (
        <>
          {res.native && file && file.path && <A.Callout tone="accent" title="APM export">pm imports every item type in this file, including notes, keys and recovery codes. The list below shows the logins and codes it contains.</A.Callout>}
          <div className="import-head"><A.Badge>{res.fmt.toUpperCase()}</A.Badge><span>{res.items.length} item{res.items.length === 1 ? "" : "s"} found</span><span className="grow" /><button type="button" className="linkbtn" onClick={() => setPick(pick.length === res.items.length ? [] : res.items.map((_, i) => i))}>{pick.length === res.items.length ? "Select none" : "Select all"}</button></div>
          {res.items.length === 0 && <A.Callout tone="warning" title="Nothing to import">No logins or authenticator codes were found in this file.</A.Callout>}
          <div className="import-list">
            {res.items.map((x, i) => (
              <label key={i} className="import-row">
                <A.Checkbox checked={pick.includes(i)} onChange={(v) => setPick(v ? pick.concat([i]) : pick.filter((p) => p !== i))} />
                <A.ItemIcon name={x.f.account} size="sm" icon={x.type === "password" ? undefined : "timer"} />
                <span className="import-name">{x.f.account}</span>
                <span className="muted">{x.type === "password" ? x.f.username || x.f.website : "Authenticator"}</span>
                {dupes[i] && <A.Badge tone="warning" size="sm">Duplicate</A.Badge>}
                {x.type === "password" && U.strength(x.f.password).score <= 1 && <A.Badge tone="danger" size="sm">Weak</A.Badge>}
              </label>
            ))}
          </div>
          <A.Select label="Import into" icon="layers" value={space} onChange={setSpace} options={[{ value: "", label: "Default" }].concat(disk.spaces.map((s) => ({ value: s.name, label: s.name })))} />
          <A.Callout tone="warning" title="Delete the export file afterwards">It holds your passwords in plain text. APM does not touch the original.</A.Callout>
        </>
      )}
      {err && <div className="apm-hint apm-hint-danger apm-hint-enter" role="alert"><A.Icon name="triangle-alert" size={14} />{err}</div>}
    </A.Dialog>
  );
}

function decodeB64(b64) {
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const csvCell = (c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"';

function ExportDialog({ ids, onClose }) {
  const disk = useStore((s) => s.disk);
  const [fmt, setFmt] = React.useState("json");
  const [encrypt, setEncrypt] = React.useState(true);
  const [pw, setPw] = React.useState("");
  const [secrets, setSecrets] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const base = ids ? disk.items.filter((i) => ids.includes(i.id)) : disk.items;
  const list = base.filter((i) => EXPORTABLE.includes(i.type));
  const skipped = base.length - list.length;
  const build = () => {
    if (fmt === "json") return JSON.stringify({ apm_export: 1, created: new Date().toISOString(), items: list.map((i) => ({ type: i.type, space: i.space || "", fields: i.f })) }, null, 2);
    if (fmt === "csv") return "type,space,name,username,secret,website\n" + list.map((i) => [i.type, i.space || "", titleOf(i), i.f.username || "", secrets ? i.f.password || i.f.secret || i.f.key || i.f.token || i.f.content || i.f.private_key || (i.f.codes || []).join(" ") : "", i.f.website || ""].map(csvCell).join(",")).join("\n") + "\n";
    return list.map((i) => titleOf(i) + " (" + getType(i.type).label + (i.space ? ", " + i.space : "") + ")" + (secrets ? ": " + (i.f.password || i.f.secret || i.f.key || i.f.token || "") : "")).join("\n") + "\n";
  };
  const ok = fmt !== "json" || !encrypt || pw.length >= 8;
  const go = async () => {
    const path = await window.apm.dialog.save({ title: "Export items", defaultPath: "apm-export." + fmt, filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }] });
    if (!path) return;
    setBusy(true); setErr(null);
    let r;
    if (!ids && (fmt === "json" || secrets)) r = await act.exportData({ format: fmt, path, password: fmt === "json" && encrypt ? pw : "", withoutPasswords: !secrets });
    else if (fmt === "json" && encrypt) { setBusy(false); setErr("Encrypted exports cover the whole vault. Turn off encryption to export only the selected items."); return; }
    else {
      try { await window.apm.files.write(path, build(), { encoding: "utf8" }); act.audit("DATA_EXPORTED", fmt.toUpperCase() + ", " + list.length + " selected items"); r = { ok: true, count: list.length }; } catch (e) { r = { ok: false, error: (e && e.message) || "Could not write the file." }; }
    }
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    ui.toast({ title: "Exported " + U.n(r.count != null ? r.count : list.length, "item"), description: path.split(/[\\/]/).pop(), icon: "file-down", action: { label: "Show", onClick: () => window.apm.shell.showItemInFolder(path) } });
    onClose();
  };
  return (
    <A.Dialog open onClose={onClose} size="md" icon="file-down" title={ids ? "Export " + ids.length + " selected items" : "Export items"} description="Exports leave the vault's protection. Encrypt them, and delete the file when you are done."
      footerStart={<span>{list.length} item{list.length === 1 ? "" : "s"}{skipped ? " · " + skipped + " of other types stay in the vault" : ""}</span>}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" icon="file-down" loading={busy} disabled={!ok || !list.length} onClick={go}>Export</A.Button></>}>
      <A.SegmentedControl label="Format" options={[{ value: "json", label: "JSON" }, { value: "csv", label: "CSV" }, { value: "txt", label: "Text" }]} value={fmt} onChange={setFmt} />
      {fmt === "json" ? (
        <A.FieldGroup>
          <A.SettingRow title="Encrypt with a password" description="You need this password to import it again. pm import reads it too."><A.Switch checked={encrypt} onChange={setEncrypt} label="Encrypt export" /></A.SettingRow>
          {encrypt && <div className="pad-16"><A.Input type="password" label="Export password" icon="key-round" value={pw} onChange={(e) => setPw(e.target.value)} hint={pw && pw.length < 8 ? "Use at least 8 characters." : "Not your master password. Pick a new one."} invalid={!!pw && pw.length < 8} /></div>}
        </A.FieldGroup>
      ) : (
        <A.FieldGroup>
          <A.SettingRow title="Include secrets" description={fmt === "csv" ? "Plain-text passwords. Needed to import elsewhere." : "Leave off for a printable inventory of what you have."}><A.Switch checked={secrets} onChange={setSecrets} label="Include secrets" /></A.SettingRow>
        </A.FieldGroup>
      )}
      <div className="stack-8"><span className="apm-label">Included types</span><div className="tagrow">{EXPORTABLE.map((t) => <A.Badge key={t} icon={getType(t).icon}>{getType(t).plural}</A.Badge>)}</div></div>
      {(fmt !== "json" || !encrypt) && secrets && <A.Callout tone="danger" title="This file will be readable by anyone">Anything that can read the folder you save it to can read every exported secret.</A.Callout>}
      {err && <div className="apm-hint apm-hint-danger apm-hint-enter" role="alert"><A.Icon name="triangle-alert" size={14} />{err}</div>}
    </A.Dialog>
  );
}

register("new", NewItemDialog);
register("delete", DeleteDialog);
register("confirm", ConfirmDialog);
register("shortcuts", ShortcutsDialog);
register("note", NoteEditor);
register("import", ImportDialog);
register("export", ExportDialog);
register("generator", GeneratorDialog);
register("space-new", SpaceNewDialog);
register("space-rename", SpaceRenameDialog);
register("space-delete", SpaceDeleteDialog);
register("move", MoveDialog);
