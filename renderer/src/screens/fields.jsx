import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { fmtSize, customFields } from "../lib/types.js";
import { ui } from "../lib/ui.js";
import { A as act } from "../lib/store.js";
import { GeneratorPopover } from "./generator.jsx";

const cx = U.cx;

export function copied(label, value, secret, clip) {
  const secs = clip == null || clip === "" ? 30 : Number(clip);
  act.copyValue(value, secret ? secs : 0);
  ui.toast({ title: "Copied " + String(label).toLowerCase(), description: secret ? null : String(value).length > 42 ? String(value).slice(0, 42) + "…" : String(value), countdown: secret && secs ? secs : 0, tone: "success" });
}

function parseEnv(s) {
  return String(s || "").split(/\n|,(?=\s*[A-Za-z_][A-Za-z0-9_]*=)/).map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf("="); return i > 0 ? { k: x.slice(0, i).trim(), v: x.slice(i + 1).trim() } : { k: x, v: "" }; });
}

export function FieldView({ def, value, item, clip, onUseCode }) {
  const onCopy = (label, v) => { copied(label, v, ["password", "secret", "secretBlock", "totp"].includes(def.kind), clip); };
  const k = def.kind;
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return null;
  if (k === "totp") return <A.SecretField label={def.label} icon={def.icon} totp={value} onCopy={onCopy} />;
  if (k === "password" || k === "secret") {
    const s = k === "password" ? U.strength(value) : null;
    return (
      <A.SecretField label={def.label} icon={def.icon} value={String(value)} secret onCopy={onCopy}>
        {s && <A.StrengthMeter score={s.score} bits={s.bits} detail={item && item.rotated ? "changed " + U.agoLong(item.rotated) : null} />}
      </A.SecretField>
    );
  }
  if (k === "secretBlock") return <A.SecretField label={def.label} icon={def.icon} value={String(value)} secret multiline onCopy={onCopy} />;
  if (k === "multiline") return <A.SecretField label={def.label} icon={def.icon} value={String(value)} multiline onCopy={onCopy} />;
  if (k === "url") { const href = /^https?:/.test(value) ? value : "https://" + value; return <A.SecretField label={def.label} icon={def.icon} value={String(value).replace(/^https?:\/\//, "")} href={href} onCopy={onCopy} />; }
  if (k === "email") return <A.SecretField label={def.label} icon={def.icon} value={value} onCopy={onCopy} />;
  if (k === "bool") return <A.SecretField label={def.label} icon={def.icon} value={value ? "Yes" : "No"} copyable={false} />;
  if (k === "date") { const dt = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : null; const days = dt ? Math.round((dt - Date.now()) / 86400000) : null; return (
    <A.SecretField label={def.label} icon={def.icon} value={dt ? U.date(dt.getTime()) : value} copyValue={value} onCopy={onCopy}>
      {days != null && days < 60 && <span className={cx("due", days < 0 ? "is-danger" : days < 30 ? "is-warning" : "")}>{days < 0 ? "Expired " + Math.abs(days) + " days ago" : days === 0 ? "Expires today" : "In " + days + " days"}</span>}
    </A.SecretField>
  ); }
  if (k === "list") return value.map((v, i) => { const href = /^https?:/.test(v) ? v : "https://" + v; return <A.SecretField key={i} label={i === 0 ? def.label : ""} icon={i === 0 ? def.icon : null} value={String(v).replace(/^https?:\/\//, "")} href={href} onCopy={onCopy} />; });
  if (k === "tags") return <div className="apm-sf"><div className="apm-sf-label"><A.Icon name={def.icon || "tag"} size={14} /><span>{def.label}</span></div><div className="apm-sf-body"><div className="tagrow">{value.map((t) => <A.Badge key={t} outline icon="tag">{t}</A.Badge>)}</div></div><div /></div>;
  if (k === "env") {
    const rows = parseEnv(value);
    return (
      <div className="apm-sf is-block">
        <div className="apm-sf-label"><A.Icon name={def.icon} size={14} /><span>{def.label}</span></div>
        <div className="apm-sf-body"><div className="envtable">{rows.map((r) => <EnvRow key={r.k} k={r.k} v={r.v} clip={clip} />)}</div></div>
        <div className="apm-sf-actions"><A.IconButton icon="copy" label="Copy as .env" onClick={() => copied(".env", rows.map((r) => r.k + "=" + r.v).join("\n"), true, clip)} /></div>
      </div>
    );
  }
  if (k === "custom") return customFields(value).map((x, i) => <A.SecretField key={i} label={x.label || "Field " + (i + 1)} icon={i === 0 ? def.icon : null} value={String(x.value || "")} secret={!!x.hidden} onCopy={(l, v) => copied(l, v, !!x.hidden, clip)} />);
  if (k === "codes") return <CodesView def={def} codes={value} used={item.f.used || []} clip={clip} onUse={onUseCode} />;
  if (k === "note") return <NoteView value={value} item={item} />;
  if (k === "file") return <FileView def={def} file={value} item={item} />;
  return <A.SecretField label={def.label} icon={def.icon} value={String(value)} mono={def.mono} onCopy={onCopy} />;
}

function EnvRow({ k, v, clip }) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="envrow">
      <span className="envkey">{k}</span>
      <span className={cx("envval", !shown && "is-masked")} onClick={() => copied(k, v, true, clip)} title="Click to copy">{shown ? v : "•".repeat(Math.min(Math.max(v.length, 8), 16))}</span>
      <A.IconButton icon={shown ? "eye-off" : "eye"} label={shown ? "Hide" : "Reveal"} size="xs" onClick={() => setShown(!shown)} />
    </div>
  );
}

function CodesView({ def, codes, used, clip, onUse }) {
  const [shown, setShown] = React.useState(false);
  const left = codes.filter((c) => !used.includes(c)).length;
  return (
    <div className="apm-sf is-block">
      <div className="apm-sf-label"><A.Icon name={def.icon} size={14} /><span>{def.label}</span></div>
      <div className="apm-sf-body">
        <div className="codes-meta">{left} of {codes.length} unused{left <= 3 && <A.Badge tone="warning" size="sm" icon="triangle-alert">Running low</A.Badge>}</div>
        <div className="codes">
          {codes.map((c) => { const u = used.includes(c); return (
            <div key={c} className={cx("code", u && "is-used")}>
              <span className="code-v" onClick={() => !u && copied("recovery code", c, true, clip)}>{shown || u ? c : "•••••-•••••"}</span>
              {!u ? <A.Tooltip label="Mark as used"><button type="button" className="code-use" aria-label={"Mark " + c + " as used"} onClick={() => onUse && onUse(c)}><A.Icon name="check" size={12} /></button></A.Tooltip> : <span className="code-used">Used</span>}
            </div>
          ); })}
        </div>
      </div>
      <div className="apm-sf-actions" style={{ opacity: 1 }}>
        <A.IconButton icon={shown ? "eye-off" : "eye"} label={shown ? "Hide codes" : "Reveal codes"} onClick={() => setShown(!shown)} />
        <A.IconButton icon="copy" label="Copy unused codes" onClick={() => copied("unused codes", codes.filter((c) => !used.includes(c)).join("\n"), true, clip)} />
      </div>
    </div>
  );
}

function NoteView({ value, item }) {
  const paras = String(value).split(/\n{2,}/);
  return (
    <div className="apm-sf is-block is-note">
      <div className="notebody">
        {paras.map((p, i) => { const lines = p.split("\n"); const list = lines.every((l) => /^\s*(\d+\.|[-*])\s/.test(l)); return list ? <ol key={i} className="note-list">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*(\d+\.|[-*])\s/, "")}</li>)}</ol> : <p key={i}>{lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{l}</React.Fragment>)}</p>; })}
      </div>
      <div className="note-foot">
        <span>{String(value).split(/\s+/).filter(Boolean).length} words · {String(value).length} characters</span>
        <A.Button size="sm" variant="ghost" icon="square-pen" onClick={() => ui.open("note", { id: item.id })}>Open editor</A.Button>
      </div>
    </div>
  );
}

function FileView({ def, file, item }) {
  const [unlocked, setUnlocked] = React.useState(item.type !== "document" || !item.f.password);
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const mime = file.mime || "";
  const icon = /^image/.test(mime) ? "image" : /^audio/.test(mime) ? "music" : /^video/.test(mime) ? "video" : /pdf/.test(mime) ? "file-text" : "file";
  const previewable = /^(image|audio|video)\//.test(mime) && (file.size || 0) <= 60 * 1048576;
  React.useEffect(() => {
    setData(null);
    if (!unlocked || !previewable) return;
    let live = true;
    setLoading(true);
    act.itemFile(item.id).then((r) => { if (live && r && r.data) setData("data:" + (r.mime || mime || "application/octet-stream") + ";base64," + r.data); setLoading(false); });
    return () => { live = false; };
  }, [item.id, unlocked, file.name, file.size]);
  return (
    <div className="apm-sf is-block is-file">
      <div className="filecard">
        <span className="filecard-icon"><A.Icon name={icon} size={20} /></span>
        <div className="filecard-text"><b>{file.name}</b><span>{fmtSize(file.size)} · {mime || "file"} · encrypted in vault</span></div>
        {unlocked ? <A.Button size="sm" icon="download" onClick={() => act.saveItemFile(item.id, file.name)}>Save a copy</A.Button> : null}
      </div>
      {!unlocked ? (
        <form className="doc-lock" onSubmit={(e) => { e.preventDefault(); if (pw === item.f.password) { setUnlocked(true); setErr(null); } else { setErr("That is not this document's password."); } }}>
          <A.Icon name="lock" size={16} />
          <span>This document has its own password.</span>
          <A.Input size="sm" type="password" placeholder="Document password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={!!err} />
          <A.Button size="sm" variant="primary" type="submit">Open</A.Button>
          {err && <span className="doc-err">{err}</span>}
        </form>
      ) : data ? (
        /^image/.test(mime) ? <img className="filepreview-img" src={data} alt={item.f.name || file.name} /> :
        /^audio/.test(mime) ? <audio className="filepreview-audio" controls src={data} /> :
        /^video/.test(mime) ? <video className="filepreview-video" controls src={data} /> : null
      ) : loading ? <div className="filepreview-empty"><A.Spinner size={14} />Decrypting…</div>
        : !previewable ? <div className="filepreview-empty"><A.Icon name="info" size={14} />No preview for this file. Save a copy to open it.</div> : null}
    </div>
  );
}

export function FieldEdit({ def, value, onChange, autoFocus, policy }) {
  const k = def.kind;
  const id = "fe-" + def.key;
  const req = def.required ? <span className="req" aria-hidden="true">*</span> : null;
  const label = <span>{def.label}{req}</span>;
  if (k === "password") {
    const s = U.strength(value || "");
    const polErr = policy && value && (value.length < policy.min_length || (policy.require_uppercase && !/[A-Z]/.test(value)) || (policy.require_numbers && !/\d/.test(value)) || (policy.require_symbols && !/[^A-Za-z0-9]/.test(value)));
    return (
      <div className="fe">
        <A.Input id={id} label={label} type="text" className="fe-pw" value={value || ""} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} spellCheck={false} autoComplete="off" icon={def.icon}
          trailing={<GeneratorPopover onUse={(v) => onChange(v)} />} invalid={!!polErr} hint={polErr ? "Policy “" + policy.name + "” needs " + policy.min_length + "+ characters" + (policy.require_uppercase ? ", an uppercase letter" : "") + (policy.require_numbers ? ", a number" : "") + (policy.require_symbols ? ", a symbol" : "") + "." : def.hint} />
        {value ? <A.StrengthMeter score={s.score} bits={s.bits} detail={U.crackPhrase(s.bits)} /> : null}
      </div>
    );
  }
  if (k === "secret" || k === "totp") return <A.Input id={id} label={label} type="text" className="mono-input" value={value || ""} onChange={(e) => onChange(k === "totp" && !/^otpauth:/i.test(e.target.value) ? e.target.value.toUpperCase() : e.target.value)} autoFocus={autoFocus} spellCheck={false} autoComplete="off" icon={def.icon} placeholder={def.placeholder} hint={k === "totp" ? "Paste the key, or an otpauth:// link. Spaces are ignored." : def.hint} />;
  if (k === "secretBlock" || k === "env") return <A.Textarea id={id} label={label} mono rows={k === "env" ? 4 : 6} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={k === "env" ? "KEY=value" : "-----BEGIN ...-----"} hint={def.hint} />;
  if (k === "multiline" || k === "note") return <A.Textarea id={id} label={label} rows={k === "note" ? 10 : 3} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} />;
  if (k === "select") return <A.Select id={id} label={label} value={value || def.options[0]} onChange={onChange} options={def.options} icon={def.icon} />;
  if (k === "date") return <A.Input id={id} label={label} type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} icon={def.icon} />;
  if (k === "number") return <A.Input id={id} label={label} type="number" className="mono-input" value={value || ""} onChange={(e) => onChange(e.target.value)} icon={def.icon} placeholder={def.placeholder} />;
  if (k === "bool") return <div className="fe fe-bool"><A.Checkbox checked={!!value} onChange={onChange} label={def.label} description="Shown first in Contacts and on the lock screen card." /></div>;
  if (k === "list" || k === "tags") return <ListEdit def={def} label={label} value={value || []} onChange={onChange} />;
  if (k === "codes") return <A.Textarea id={id} label={label} mono rows={5} value={(value || []).join("\n")} onChange={(e) => onChange(e.target.value.split(/\n/).map((x) => x.trim()).filter(Boolean))} placeholder={"One code per line"} hint={(value || []).length + " codes"} />;
  if (k === "file") return <FileEdit def={def} label={label} value={value} onChange={onChange} />;
  if (k === "custom") return <CustomEdit def={def} label={label} value={value || []} onChange={onChange} />;
  return <A.Input id={id} label={label} type={k === "email" ? "email" : k === "phone" ? "tel" : "text"} className={def.mono ? "mono-input" : undefined} value={value || ""} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} placeholder={def.placeholder} icon={def.icon} hint={def.hint} spellCheck={def.mono ? false : undefined} />;
}

function ListEdit({ def, label, value, onChange }) {
  const [v, setV] = React.useState("");
  const add = () => { const parts = def.kind === "list" ? v.split(/[\s,]+/) : [v]; const next = value.slice(); parts.map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!next.includes(x)) next.push(x); }); if (next.length !== value.length) onChange(next); setV(""); };
  return (
    <div className="apm-field">
      <span className="apm-label">{label}</span>
      {value.length > 0 && <div className="tagrow">{value.map((x) => <span key={x} className="space-chip">{x}<button type="button" aria-label={"Remove " + x} onClick={() => onChange(value.filter((y) => y !== x))}><A.Icon name="x" size={12} /></button></span>)}</div>}
      <div className="inline-add"><A.Input placeholder={def.placeholder || (def.kind === "tags" ? "Add a tag" : "Add")} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={() => { if (def.kind === "list" && v.trim()) add(); }} icon={def.icon} /><A.Button onClick={add} disabled={!v.trim()}>Add</A.Button></div>
    </div>
  );
}

function CustomEdit({ def, label, value, onChange }) {
  const set = (i, patch) => onChange(value.map((x, j) => (j === i ? Object.assign({}, x, patch) : x)));
  return (
    <div className="apm-field">
      <span className="apm-label">{label}</span>
      {value.map((x, i) => (
        <div key={i} className="cf-row">
          <A.Input size="sm" className="cf-label" placeholder="Label" value={x.label || ""} onChange={(e) => set(i, { label: e.target.value })} aria-label={"Field " + (i + 1) + " label"} autoFocus={!x.label && !x.value && i === value.length - 1} />
          <A.Input size="sm" className={cx("cf-value", x.hidden && "fe-pw")} type={x.hidden ? "password" : "text"} placeholder="Value" value={x.value || ""} onChange={(e) => set(i, { value: e.target.value })} aria-label={(x.label || "Field " + (i + 1)) + " value"} spellCheck={false} autoComplete="off" />
          <A.IconButton icon={x.hidden ? "eye-off" : "eye"} label={x.hidden ? "Hidden like a password. Click to show it plainly" : "Shown plainly. Click to hide it like a password"} active={!!x.hidden} onClick={() => set(i, { hidden: !x.hidden })} />
          <A.IconButton icon="x" label="Remove field" onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div><A.Button size="sm" variant="ghost" icon="plus" onClick={() => onChange(value.concat([{ label: "", value: "", hidden: false }]))}>Add field</A.Button></div>
      <span className="apm-hint">PINs, security answers, account numbers. Hidden fields are masked and copied like passwords.</span>
    </div>
  );
}

function FileEdit({ def, label, value, onChange }) {
  const [err, setErr] = React.useState(null);
  const ref = React.useRef(null);
  const take = (f) => {
    if (!f) return;
    if (f.size > 50 * 1048576) { setErr("Files over 50 MB make the vault slow to open and sync. Keep large files outside the vault."); return; }
    setErr(null);
    const r = new FileReader(); r.onload = () => { const s = String(r.result); onChange({ name: f.name, size: f.size, mime: f.type || "application/octet-stream", data: s.slice(s.indexOf(",") + 1) }); }; r.readAsDataURL(f);
  };
  return (
    <div className="apm-field">
      <span className="apm-label">{label}</span>
      <input ref={ref} type="file" hidden accept={def.accept} onChange={(e) => take(e.target.files[0])} />
      <A.FileDrop file={value ? { name: value.name, size: value.size, detail: fmtSize(value.size) + " · click to replace" } : null} title="Drop a file or click to choose" hint="Encrypted into the vault. The original stays where it is; delete it yourself." onChoose={() => ref.current.click()} onDrop={take} />
      {err && <A.Hint tone="danger" icon="triangle-alert">{err}</A.Hint>}
    </div>
  );
}

export function parseOtpauth(s) {
  const m = String(s || "").match(/^otpauth:\/\/totp\/([^?]*)\?(.*)$/i);
  if (!m) return null;
  const params = new URLSearchParams(m[2]);
  const label = decodeURIComponent(m[1]);
  const issuer = params.get("issuer") || label.split(":")[0];
  return { account: issuer, secret: (params.get("secret") || "").toUpperCase(), label };
}
