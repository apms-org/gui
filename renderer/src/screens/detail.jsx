import { A } from "../lib/ds.js";
import { Cli } from "../ui/kit.jsx";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { getType, titleOf, primaryValue, passwordKey, activePolicy, byAi } from "../lib/types.js";
import { ui, useUi, openUrl } from "../lib/ui.js";
import { trustOf, LEVEL_TONE, LEVEL_LABEL } from "../lib/health.js";
import { FieldView, FieldEdit, copied, parseOtpauth } from "./fields.jsx";
import { SPACE_COLORS } from "./spaces.jsx";
import { iconFor, useIcons } from "../lib/icons.js";

const cx = U.cx;

// ownTotp shapes a login's own 2FA key like an Authenticator item, so every
// place that shows or copies codes treats both the same way.
export function ownTotp(it) {
  if (it.type !== "password" || !it.f.totp) return null;
  const host = String(it.f.website || "").replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").toLowerCase();
  return { id: it.id, type: "totp", space: it.space, fav: it.fav, f: { account: it.f.account, secret: it.f.totp, domain: host }, own: true, login: it };
}
export function linkedTotp(disk, it) {
  if (it.type !== "password") return null;
  const own = ownTotp(it);
  if (own) return own;
  const name = String(it.f.account || "").toLowerCase();
  const host = String(it.f.website || "").replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  return disk.items.find((x) => x.type === "totp" && x.f.secret && ((String(x.f.account || "").toLowerCase() === name) || (host && String(x.f.domain || "").toLowerCase() === host))) || null;
}
export function linkedLogin(disk, it) {
  if (it.type !== "totp") return null;
  const name = String(it.f.account || "").toLowerCase();
  return disk.items.find((x) => x.type === "password" && String(x.f.account || "").toLowerCase() === name) || null;
}

export function SpaceChip({ name, disk }) {
  const sp = disk.spaces.find((s) => s.name === name);
  return <span className="spacechip"><i style={{ background: SPACE_COLORS[sp ? sp.color : 7] }} />{name || "Default"}</span>;
}

export function itemMenu(it, disk, extra) {
  const t = getType(it.type);
  const pk = passwordKey(it.type);
  const clip = disk.settings.clipboard;
  const items = [];
  if (t.primary && primaryValue(it)) items.push({ label: "Copy " + (t.fields.find((x) => x.key === t.primary) || { label: "secret" }).label.toLowerCase(), icon: "copy", kbd: "⇧ ⌘ C", onSelect: () => { copied(t.fields.find((x) => x.key === t.primary).label, primaryValue(it), true, clip); act.used(it.id); } });
  if (it.f.username) items.push({ label: "Copy username", icon: "user", kbd: "⇧ ⌘ U", onSelect: () => copied("username", it.f.username, false, clip) });
  const tot = linkedTotp(disk, it) || (it.type === "totp" ? it : null);
  if (tot) items.push({ label: "Copy one-time code", icon: "timer", kbd: "⇧ ⌘ T", onSelect: async () => { const c = await A.totp(tot.f.secret.replace(/\s/g, "")); copied("one-time code", c, true, clip); } });
  const site = it.f.website || (Array.isArray(it.f.urls) ? it.f.urls.find(Boolean) : "");
  if (site) items.push({ label: "Open website", icon: "external-link", kbd: "⇧ ⌘ O", onSelect: () => openUrl(site) });
  items.push({ separator: true });
  items.push({ label: it.fav ? "Remove from favorites" : "Add to favorites", icon: "star", onSelect: () => act.favItems([it.id], !it.fav) });
  items.push({ label: "Edit", icon: "pencil", kbd: "⌘ E", onSelect: () => { ui.select(it.id); ui.edit(it.id); } });
  items.push({ label: "Duplicate", icon: "copy-plus", onSelect: async () => { const c = await act.duplicate(it.id); if (c) { ui.select(c.id); ui.toast({ title: "Duplicated " + titleOf(it) }); } } });
  items.push({ label: "Move to space…", icon: "folder", onSelect: () => ui.open("move", { ids: [it.id] }) });
  items.push({ label: "Quick look", icon: "eye", kbd: "Space", onSelect: () => ui.quick(it.id) });
  if (pk) items.push({ label: "Change password…", icon: "refresh-cw", onSelect: () => { ui.select(it.id); ui.edit(it.id); } });
  if (extra) items.push(...extra);
  items.push({ separator: true });
  items.push({ label: "Delete", icon: "trash-2", danger: true, kbd: "⌘ ⌫", onSelect: () => ui.open("delete", { ids: [it.id] }) });
  return items;
}

export function Detail({ item: it, analysis }) {
  const disk = useStore((s) => s.disk);
  const session = useStore((s) => s.session);
  const u = useUi();
  const [tab, setTab] = React.useState("item");
  useIcons();
  const editing = u.editing === it.id;
  const t = getType(it.type);
  React.useEffect(() => { setTab("item"); }, [it.id]);
  if (editing) return <EditItem it={it} />;
  const issues = analysis.issues.filter((x) => x.item.id === it.id);
  const tot = linkedTotp(disk, it);
  const login = linkedLogin(disk, it);
  const trust = trustOf(it);
  const clip = disk.settings.clipboard;
  const ro = session.readonly;
  const fields = t.fields.filter((f) => f.key !== t.titleKey);
  return (
    <section className="detail" aria-label={titleOf(it)}>
      <div className="detail-bar drag">
        <div className="crumbs nodrag">
          <button type="button" className="crumb" onClick={() => ui.go({ view: "vault", filter: "type:" + it.type })}><A.Icon name={t.icon} size={14} /><b>{t.plural}</b></button>
          <A.Icon name="chevron-right" size={12} />
          <span className="crumb-cur">{titleOf(it)}</span>
        </div>
        <div className="detail-actions nodrag">
          <A.IconButton icon="star" label={it.fav ? "Remove from favorites" : "Add to favorites"} filled={it.fav} active={it.fav} onClick={() => act.favItems([it.id], !it.fav)} />
          <A.IconButton icon="history" label="Version history" active={tab === "versions"} onClick={() => setTab(tab === "versions" ? "item" : "versions")} />
          <A.IconButton icon="activity" label="Details and activity" active={tab === "meta"} onClick={() => setTab(tab === "meta" ? "item" : "meta")} />
          <span className="bar-gap" />
          <A.Button variant="secondary" size="sm" icon="pencil" onClick={() => ui.edit(it.id)} disabled={ro}>Edit</A.Button>
          <A.Menu align="end" width={250} trigger={<A.IconButton icon="ellipsis" label="More actions" tip={false} />} items={itemMenu(it, disk)} />
        </div>
      </div>
      <div className="detail-scroll">
        <div className="detail-body" key={it.id + tab}>
          <div className="hero">
            <A.ItemIcon name={titleOf(it)} size="lg" icon={it.type === "password" ? undefined : t.icon} src={iconFor(it)} />
            <div className="hero-text">
              <h2 className="title-1 hero-title">{titleOf(it)}</h2>
              <div className="hero-badges">
                <A.Badge icon={t.icon}>{t.label}</A.Badge>
                <SpaceChip name={it.space} disk={disk} />
                {(tot || it.type === "totp") && <A.Badge tone="success" icon="shield-check">2FA on</A.Badge>}
                {it.passkeys && it.passkeys.length > 0 && <A.Badge tone="accent" icon="fingerprint">{it.passkeys.length === 1 ? "Passkey" : it.passkeys.length + " passkeys"}</A.Badge>}
                {byAi(it) && <A.Badge icon="bot">Added by AI</A.Badge>}
              </div>
              <div className="hero-ident">
                <button type="button" className="ident" title="Identifier used by pm and .apmignore. Click to copy." onClick={() => { A.copyText((it.space || "Default") + ":" + it.type + ":" + titleOf(it)); ui.toast({ title: "Identifier copied", tone: "neutral", icon: "copy" }); }}><span className="ident-sp">{it.space || "Default"}</span><i>:</i>{it.type}<i>:</i><b>{titleOf(it)}</b></button>
                <Cli cmd={"pm get \"" + titleOf(it) + "\""} />
              </div>
            </div>
          </div>
          {tab === "item" && <>
            {issues.slice(0, 2).map((x) => (
              <A.Callout key={x.id} tone={x.tone} title={x.title} action={passwordKey(it.type) && (x.kind === "weak" || x.kind === "reused" || x.kind === "old") ? <A.Button size="sm" onClick={() => ui.edit(it.id)} disabled={ro}>Change password</A.Button> : x.kind === "exposed" ? <A.Button size="sm" onClick={() => act.patchMeta(it.id, { exposed: false }, "Cleared exposed flag on " + titleOf(it))}>Clear flag</A.Button> : null}>{x.body}</A.Callout>
            ))}
            <A.FieldGroup>
              {fields.map((f) => <FieldView key={f.key} def={f} value={it.f[f.key]} item={it} clip={clip} onUseCode={(c) => act.useCode(it.id, c)} />)}
              {tot && !tot.own && <A.SecretField label="One-time code" icon="timer" totp={tot.f.secret.replace(/\s/g, "")} onCopy={(l, v) => copied(l, v, true, clip)} extra={<A.IconButton icon="link-2" label={"From Authenticator: " + titleOf(tot)} onClick={() => ui.select(tot.id)} />} />}
              {login && <A.SecretField label="Used by" icon="link-2" value={<button type="button" className="linkbtn" onClick={() => ui.select(login.id)}>{titleOf(login)} login</button>} copyable={false} />}
              {!fields.some((f) => it.f[f.key] && (!Array.isArray(it.f[f.key]) || it.f[f.key].length)) && !tot && <div className="fields-empty">No details yet. <button type="button" className="linkbtn" onClick={() => ui.edit(it.id)}>Add some</button></div>}
            </A.FieldGroup>
            {it.passkeys && it.passkeys.length > 0 && <Passkeys it={it} />}
            <div className="meta-foot">
              {it.created > 0 && <span>Created {U.date(it.created)}</span>}
              {it.modified > 0 && <span>Modified {U.agoLong(it.modified)}</span>}
              {(it.versions || []).length > 0 ? <button type="button" className="linkbtn" onClick={() => setTab("versions")}><A.Icon name="history" size={12} />{U.n(it.versions.length, "earlier version")}</button> : <span>No earlier versions</span>}
              <span className={"trust-inline is-" + trust.level}>Trust {trust.score}</span>
            </div>
          </>}
          {tab === "versions" && <Versions it={it} />}
          {tab === "meta" && <Meta it={it} trust={trust} />}
        </div>
      </div>
    </section>
  );
}

function Passkeys({ it }) {
  const [editing, setEditing] = React.useState(null);
  const [label, setLabel] = React.useState("");
  return (
    <div className="section">
      <div className="section-h"><span>Passkeys</span></div>
      <A.FieldGroup>
        {it.passkeys.map((p) => (
          <div className="pkrow" key={p.id}>
            <span className="pkrow-icon"><A.Icon name="fingerprint" size={16} /></span>
            {editing === p.id ? (
              <form className="pkrow-edit" onSubmit={async (e) => { e.preventDefault(); const r = await act.passkeyRename(p.credentialId, label); setEditing(null); if (r.ok) ui.toast({ title: "Passkey renamed" }); }}>
                <A.Input size="sm" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Passkey name" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditing(null); } }} />
                <A.Button size="sm" variant="primary" type="submit">Save</A.Button>
                <A.Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</A.Button>
              </form>
            ) : (
              <>
                <div className="pkrow-text"><b>{p.label || p.userName}</b><span className="mono-small">{p.rpId}</span><span>Added {p.createdAt ? U.date(p.createdAt) : "earlier"} · {p.lastUsedAt ? "used " + U.agoLong(p.lastUsedAt) : "never used"} · {p.signCount} sign-ins</span></div>
                <A.IconButton icon="pencil" label="Rename passkey" onClick={() => { setEditing(p.id); setLabel(p.label || ""); }} />
                <A.IconButton icon="trash-2" label="Remove passkey" onClick={() => ui.open("confirm", { title: "Remove this passkey?", description: "You will no longer be able to sign in to " + p.rpId + " with it. Removing it here does not remove it from the website's account settings.", icon: "fingerprint", tone: "danger", confirm: "Remove passkey", onConfirm: async () => { const r = await act.passkeyRemove(p.credentialId); if (r.ok) ui.toast({ title: "Passkey removed" }); } })} />
              </>
            )}
          </div>
        ))}
      </A.FieldGroup>
    </div>
  );
}

function EditPasskeys({ it }) {
  if (it.passkeys && it.passkeys.length) return <Passkeys it={it} />;
  return (
    <div className="section">
      <div className="section-h"><span>Passkeys</span></div>
      <div className="fields-empty"><A.Icon name="fingerprint" size={14} />No passkeys yet. When a site offers to create one, the APM browser extension saves it to this login.</div>
    </div>
  );
}

function diffVal(x) {
  if (x == null || x === "" || (Array.isArray(x) && !x.length)) return "empty";
  if (Array.isArray(x)) return x.map((y) => (y && typeof y === "object" ? y.label || "field" : y)).join(", ");
  return String(x);
}

function diffKeys(a, b) { const ks = new Set(Object.keys(a || {}).concat(Object.keys(b || {}))); return Array.from(ks).filter((k) => JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])); }

function Versions({ it }) {
  const t = getType(it.type);
  const vs = it.versions || [];
  const labelOf = (k) => (t.fields.find((x) => x.key === k) || { label: k }).label;
  return (
    <div className="section">
      <div className="section-h"><span>Version history</span><span className="muted">Kept inside the item. Whole-vault history lives in History.</span></div>
      <div className="versions">
        <div className="version is-current"><span className="version-dot" /><div className="version-text"><b>Current version</b><span>{it.modified ? U.dateTime(it.modified) : "Now"}</span></div><A.Badge size="sm">Now</A.Badge></div>
        {vs.length === 0 && <div className="version"><span className="version-dot" /><div className="version-text"><span>No earlier versions. APM keeps up to 20 per item.</span></div></div>}
        {vs.map((v, i) => { const prev = i === 0 ? it.f : vs[i - 1].f; const changed = diffKeys(v.f, prev); return (
          <div className="version" key={i}>
            <span className="version-dot" />
            <div className="version-text">
              <b>{U.dateTime(v.ts)}</b>
              <span>{changed.length ? "Changed " + changed.map(labelOf).join(", ").toLowerCase() : "No field changes"}</span>
              <div className="version-diff">{changed.slice(0, 3).map((k) => { const secret = ["password", "secret", "secretBlock", "totp"].includes((t.fields.find((x) => x.key === k) || {}).kind); return <div key={k} className="diffrow"><span className="diffk">{labelOf(k)}</span><span className="diffold">{secret ? "••••••" : diffVal(v.f[k])}</span><A.Icon name="arrow-right" size={12} /><span className="diffnew">{secret ? "••••••" : diffVal(prev[k])}</span></div>; })}</div>
            </div>
            <A.Button size="sm" variant="ghost" icon="rotate-ccw" onClick={() => ui.open("confirm", { title: "Restore this version?", description: "The current values become a new version, so you can undo this too.", icon: "rotate-ccw", confirm: "Restore version", onConfirm: async () => { const r = await act.restoreVersion(it.id, i); if (r.ok) ui.toast({ title: "Version restored" }); } })}>Restore</A.Button>
          </div>
        ); })}
      </div>
    </div>
  );
}

function Meta({ it, trust }) {
  const disk = useStore((s) => s.disk);
  const events = disk.history.filter((h) => h.identifier === titleOf(it) && h.category === it.type).slice(0, 12);
  return (
    <div className="stack-24">
      <div className="section">
        <div className="section-h"><span>Trust score</span><A.Badge tone={LEVEL_TONE[trust.level]} dot>{LEVEL_LABEL[trust.level]}</A.Badge></div>
        <div className="trustcard">
          <div className="trustnum"><b>{trust.score}</b><span>/ 100</span></div>
          <div className="trustbar"><A.Progress value={trust.score} tone={LEVEL_TONE[trust.level] === "accent" ? undefined : LEVEL_TONE[trust.level]} /></div>
          <div className="trustfactors">{trust.reasons.length ? trust.reasons.map((r) => <div key={r.text} className="trustf"><span>{r.text}</span><span className="mono-small">{r.delta}</span></div>) : <div className="trustf"><span>No risk factors</span><span className="mono-small">0</span></div>}</div>
        </div>
      </div>
      <div className="section">
        <div className="section-h"><span>Details</span></div>
        <A.FieldGroup>
          <A.SettingRow title="Privilege" description="How much damage this secret could do. Root and admin lower the trust score.">
            <A.Select size="sm" value={it.privilege || "none"} onChange={(v) => act.patchMeta(it.id, { privilege: v === "none" ? "" : v }, "Set privilege on " + titleOf(it))} options={[{ value: "none", label: "Normal" }, { value: "elevated", label: "Elevated" }, { value: "admin", label: "Admin" }, { value: "root", label: "Root" }, { value: "critical", label: "Critical" }]} />
          </A.SettingRow>
          <A.SettingRow title="Exposed" description="Mark a secret you know leaked. It drops 45 trust points until you rotate it.">
            <A.Switch checked={!!it.exposed} onChange={(v) => act.patchMeta(it.id, { exposed: v }, (v ? "Marked " : "Unmarked ") + titleOf(it) + " as exposed")} label="Exposed" />
          </A.SettingRow>
        </A.FieldGroup>
        <div className="kv-list kv-card">
          <div className="kv"><div className="kv-label">Space</div><div className="kv-value"><SpaceChip name={it.space} disk={disk} /></div></div>
          <div className="kv"><div className="kv-label">Created</div><div className="kv-value">{it.created ? U.dateTime(it.created) : "Before APM tracked it"} by {byAi(it) ? "an AI client" : "you"}</div></div>
          <div className="kv"><div className="kv-label">Last used</div><div className="kv-value">{it.used ? U.agoLong(it.used) : "Never"} · {it.uses} time{it.uses === 1 ? "" : "s"}</div></div>
          <div className="kv"><div className="kv-label">Last rotated</div><div className="kv-value">{it.rotated || it.created ? U.date(it.rotated || it.created) + " · " + trust.ageDays + " days" : "Unknown"}</div></div>
          <div className="kv"><div className="kv-label">Category key</div><div className="kv-value is-mono">{it.type}|{titleOf(it)}|{it.space || "default"}</div></div>
          <div className="kv"><div className="kv-label">Item ID</div><div className="kv-value is-mono">{it.id}</div></div>
        </div>
      </div>
      <div className="section">
        <div className="section-h"><span>Activity</span><span className="muted">From the signed in-vault history</span></div>
        <div className="activity">{events.map((e, i) => <div key={i} className="activity-row"><A.Badge size="sm" tone={e.action === "DEL" ? "danger" : e.action === "ADD" ? "success" : "neutral"}>{e.action}</A.Badge><span>{e.action === "GET" ? "Viewed or copied" : e.action === "ADD" ? "Added" : e.action === "DEL" ? "Deleted" : e.action === "MERGE" ? "Merged from sync" : "Edited"}</span><span className="muted">{U.dateTime(e.ts)}</span><A.Icon name="check-check" size={13} className="verified-ic" /></div>)}</div>
      </div>
    </div>
  );
}

function EditItem({ it }) {
  const disk = useStore((s) => s.disk);
  const t = getType(it.type);
  const [f, setF] = React.useState(() => JSON.parse(JSON.stringify(it.f)));
  const [space, setSpace] = React.useState(it.space || "");
  const [err, setErr] = React.useState(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(it.f) || space !== (it.space || "");
  const [busy, setBusy] = React.useState(false);
  useIcons();
  const save = async () => {
    if (busy || !dirty) return;
    const miss = t.fields.find((x) => x.required && (f[x.key] == null || f[x.key] === "" || (Array.isArray(f[x.key]) && !f[x.key].length)));
    if (miss) { setErr("“" + miss.label + "” is required."); return; }
    const data = Object.assign({}, f);
    if (it.type === "password" && data.totp) { const p = parseOtpauth(data.totp); if (p) data.totp = p.secret; data.totp = String(data.totp).replace(/[\s-]/g, "").toUpperCase(); if (!/^[A-Z2-7]+=*$/.test(data.totp)) { setErr("That two-factor setup key is not valid. Paste the key or the otpauth:// link the site shows."); return; } }
    if (Array.isArray(data.fields)) data.fields = data.fields.filter((x) => x && (String(x.label || "").trim() || String(x.value || "").trim()));
    if (it.type === "totp") { const p = parseOtpauth(data.secret); if (p) data.secret = p.secret; data.secret = String(data.secret).replace(/\s/g, "").toUpperCase(); if (!/^[A-Z2-7]+=*$/.test(data.secret)) { setErr("That setup key is not valid base32."); return; } }
    const pol = activePolicy(disk);
    if (pol && pol.min_length && passwordKey(it.type) && data.password && data.password !== it.f.password && data.password.length < pol.min_length) { setErr("Policy “" + pol.name + "” needs passwords of at least " + pol.min_length + " characters."); return; }
    setBusy(true);
    const r = await act.updateItem(it.id, { f: data, space });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    ui.edit(null);
    ui.toast({ title: "Saved " + (data[t.titleKey] || t.label) });
  };
  const cancel = () => { if (dirty) ui.open("confirm", { title: "Discard your changes?", description: "Edits to this item have not been saved.", icon: "triangle-alert", tone: "warning", confirm: "Discard", onConfirm: () => ui.edit(null) }); else ui.edit(null); };
  React.useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } if (e.key === "Escape" && !document.querySelector(".apm-overlay,.popover")) { e.preventDefault(); cancel(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <section className="detail is-editing" aria-label={"Edit " + titleOf(it)}>
      <div className="detail-bar drag">
        <div className="crumbs nodrag"><A.Icon name="pencil" size={14} /><b>Editing</b><A.Icon name="chevron-right" size={12} /><span className="crumb-cur">{titleOf(it)}</span></div>
        <div className="detail-actions nodrag">
          <A.Button variant="ghost" size="sm" onClick={cancel}>Cancel</A.Button>
          <A.Button variant="primary" size="sm" icon="check" kbd="⌘ S" onClick={save} disabled={!dirty} loading={busy}>Save</A.Button>
        </div>
      </div>
      <div className="detail-scroll">
        <div className="detail-body edit-body">
          <div className="hero">
            <A.ItemIcon name={f[t.titleKey] || t.label} size="lg" icon={it.type === "password" ? undefined : t.icon} src={iconFor(it)} />
            <div className="hero-text grow">
              <input className="title-input" value={f[t.titleKey] || ""} onChange={(e) => setF({ ...f, [t.titleKey]: e.target.value })} placeholder={t.label + " name"} aria-label="Name" autoFocus />
              <div className="hero-badges"><A.Badge icon={t.icon}>{t.label}</A.Badge></div>
            </div>
          </div>
          <div className="edit-grid">
            {t.fields.filter((x) => x.key !== t.titleKey).map((x) => <FieldEdit key={x.key} def={x} value={f[x.key]} onChange={(v) => setF({ ...f, [x.key]: v })} policy={activePolicy(disk)} />)}
            <A.Select label="Space" icon="layers" value={space} onChange={setSpace} options={[{ value: "", label: "Default" }].concat(disk.spaces.map((s) => ({ value: s.name, label: s.name })))} />
          </div>
          {it.type === "password" && <EditPasskeys it={it} />}
          {err && <div className="apm-hint apm-hint-danger apm-hint-enter"><A.Icon name="triangle-alert" size={14} />{err}</div>}
          <p className="help">Saving keeps the current values as a version you can restore. Press <A.Kbd keys={["⌘", "S"]} /> to save, <A.Kbd keys={["Esc"]} /> to cancel.</p>
        </div>
      </div>
    </section>
  );
}
