import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, store, randHex } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { KEYS, PRESETS, tokensFor, contrast } from "../lib/themes.js";
import { Card, Head } from "./common.jsx";

const cx = U.cx;

function Mini({ c, label }) {
  return (
    <span className="mini" style={{ background: c.bg, borderColor: c.b1 }} aria-hidden="true">
      <span className="mini-side" style={{ background: c.s2, borderColor: c.b1 }}>
        <i style={{ background: c.t2, opacity: 0.5 }} /><i style={{ background: c.accent }} /><i style={{ background: c.t2, opacity: 0.35 }} /><i style={{ background: c.t2, opacity: 0.35 }} />
      </span>
      <span className="mini-main">
        <span className="mini-line is-on" style={{ background: c.s4 }}><b style={{ background: c.t1 }} /><s style={{ background: c.t2 }} /></span>
        <span className="mini-line"><b style={{ background: c.t1, opacity: 0.8 }} /><s style={{ background: c.t2 }} /></span>
        <span className="mini-line"><b style={{ background: c.t1, opacity: 0.8 }} /><s style={{ background: c.t2 }} /></span>
        <span className="mini-btn" style={{ background: c.accent }} />
        <span className="mini-dot" style={{ background: c.accent2 }} />
      </span>
      {label && <span className="mini-label" style={{ color: c.t2 }}>{label}</span>}
    </span>
  );
}

export function Appearance({ theme }) {
  const prefs = useStore((s) => s.prefs);
  const custom = prefs.customThemes || [];
  const cur = prefs.theme || "system";
  const mode = cur === "system" || cur === "light" || cur === "dark" ? cur : "custom";
  const set = (id) => store.savePrefs({ theme: id });
  const all = PRESETS.filter((p) => !p.native).concat(custom);
  return (
    <>
      <Head title="Appearance" description="Themes change the whole app, including the lock screen. Every theme is checked for readable contrast before it is applied." />
      <Card title="Mode">
        <div className="modes">
          {[["system", "System", null], ["light", "Light", PRESETS[1].c], ["dark", "Dark", PRESETS[0].c]].map(([id, label, c]) => (
            <button key={id} type="button" className={cx("mode", mode === id && "is-on")} aria-pressed={mode === id ? "true" : "false"} onClick={() => set(id)}>
              {c ? <Mini c={c} /> : <span className="mini-split"><Mini c={PRESETS[1].c} /><Mini c={PRESETS[0].c} /></span>}
              <span className="mode-label">{mode === id && <A.Icon name="check" size={13} strokeWidth={2.5} />}{label}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Themes" description="Hand-tuned palettes. Status colors are adjusted per theme so warnings and errors stay legible."
        actions={<A.Button size="sm" icon="palette" onClick={() => ui.open("theme-editor", {})}>New theme</A.Button>}>
        <div className="themes">
          {all.map((t) => {
            const isCustom = custom.includes(t);
            return (
              <div key={t.id} className={cx("theme", cur === t.id && "is-on")}>
                <button type="button" className="theme-hit" onClick={() => set(t.id)} aria-pressed={cur === t.id ? "true" : "false"} aria-label={"Use " + t.name}><Mini c={t.c} /></button>
                <div className="theme-foot">
                  <span className="theme-name">{cur === t.id && <A.Icon name="check" size={12} strokeWidth={2.5} />}{t.name}</span>
                  {isCustom ? <A.Menu align="end" width={180} trigger={<A.IconButton icon="ellipsis" label={"More for " + t.name} size="xs" tip={false} />} items={[
                    { label: "Edit", icon: "pencil", onSelect: () => ui.open("theme-editor", { id: t.id }) },
                    { label: "Duplicate", icon: "copy-plus", onSelect: () => store.savePrefs({ customThemes: custom.concat([Object.assign({}, t, { id: "c" + randHex(4), name: t.name + " copy" })]) }) },
                    { label: "Copy as JSON", icon: "copy", onSelect: () => { A.copyText(JSON.stringify({ name: t.name, base: t.base, colors: t.c }, null, 2)); ui.toast({ title: "Theme copied as JSON", tone: "neutral" }); } },
                    { separator: true },
                    { label: "Delete", icon: "trash-2", danger: true, onSelect: () => store.savePrefs({ customThemes: custom.filter((x) => x.id !== t.id), theme: cur === t.id ? "system" : cur }) }
                  ]} /> : <span className="theme-desc">{t.base === "light" ? "Light" : "Dark"}</span>}
                </div>
              </div>
            );
          })}
          <button type="button" className="theme theme-new" onClick={() => ui.open("theme-editor", {})}><A.Icon name="plus" size={18} /><span>Make your own</span></button>
        </div>
      </Card>
      <Card title="Layout" flush>
        <A.SettingRow title="Density" description="Compact fits about 30% more rows in the item list."><A.SegmentedControl label="Density" value={prefs.density || "comfortable"} onChange={(v) => store.savePrefs({ density: v })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></A.SettingRow>
        <A.SettingRow title="Show sidebar" description="Toggle it any time with ⇧⌘B."><A.Switch label="Show sidebar" checked={prefs.sidebar !== false} onChange={(v) => store.savePrefs({ sidebar: v })} /></A.SettingRow>
        <A.SettingRow title="Show pm commands" description="Small command chips next to settings and actions, so you can do the same thing from the terminal. Click one to copy it."><A.Switch label="Show pm commands" checked={prefs.showCli !== false} onChange={(v) => store.savePrefs({ showCli: v })} /></A.SettingRow>
        <A.SettingRow title="Commit receipts" description="Show the History commit for each change in the confirmation toast."><A.Switch label="Commit receipts" checked={prefs.receipts !== false} onChange={(v) => store.savePrefs({ receipts: v })} /></A.SettingRow>
      </Card>
    </>
  );
}

function ThemeEditor({ id, onClose }) {
  const prefs = useStore((s) => s.prefs);
  const custom = prefs.customThemes || [];
  const existing = id && custom.find((t) => t.id === id);
  const [name, setName] = React.useState(existing ? existing.name : "My theme");
  const [c, setC] = React.useState(Object.assign({}, existing ? existing.c : PRESETS[3].c));
  const [from, setFrom] = React.useState(existing ? "" : PRESETS[3].id);
  const { vars, base } = tokensFor({ c });
  const checks = [
    { label: "Text on background", a: c.t1, b: c.bg, min: 7 },
    { label: "Secondary text on fill", a: c.t2, b: c.s4, min: 4.5, fixed: vars["--text-secondary"] },
    { label: "Accent on surface", a: c.accent, b: c.s3, min: 4.5, fixed: vars["--accent"] },
    { label: "Border on background", a: c.b1, b: c.bg, min: 1.15 }
  ];
  const save = () => {
    const t = { id: existing ? existing.id : "c" + randHex(4), name: name.trim() || "Untitled", desc: "Custom", base, c };
    const list = existing ? custom.map((x) => (x.id === t.id ? t : x)) : custom.concat([t]);
    store.savePrefs({ customThemes: list, theme: t.id });
    ui.toast({ title: (existing ? "Updated " : "Applied ") + t.name, icon: "palette" });
    onClose();
  };
  const hexOk = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
  return (
    <A.Dialog open onClose={onClose} size="lg" icon="palette" title={existing ? "Edit theme" : "New theme"} description="Nine colors. APM derives hover, pressed, soft and status shades from them."
      footerStart={<A.Button size="sm" variant="ghost" icon="copy" onClick={() => { A.copyText(JSON.stringify({ name, base, colors: c }, null, 2)); ui.toast({ title: "Copied as JSON", tone: "neutral" }); }}>Copy JSON</A.Button>}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" onClick={save}>{existing ? "Save theme" : "Save and apply"}</A.Button></>} bodyClassName="te-body">
      <div className="te">
        <div className="te-controls">
          <div className="grid-2">
            <A.Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={28} />
            <A.Select label="Start from" value={from} onChange={(v) => { setFrom(v); const p = PRESETS.find((x) => x.id === v); if (p) setC(Object.assign({}, p.c)); }} options={[{ value: "", label: "Current colors" }].concat(PRESETS.map((p) => ({ value: p.id, label: p.name })))} />
          </div>
          <div className="te-keys">
            {KEYS.map((k) => (
              <label key={k.key} className="te-key">
                <span className="te-sw" style={{ background: c[k.key] }}><input type="color" value={hexOk(c[k.key]) ? c[k.key] : "#000000"} onChange={(e) => setC(Object.assign({}, c, { [k.key]: e.target.value }))} aria-label={k.label} /></span>
                <span className="te-key-text"><b>{k.label}</b><span>{k.hint}</span></span>
                <input className="te-hex mono" value={c[k.key]} spellCheck={false} onChange={(e) => { const v = e.target.value.trim(); setC(Object.assign({}, c, { [k.key]: v })); }} aria-label={k.label + " hex"} />
              </label>
            ))}
          </div>
        </div>
        <div className="te-side">
          <div className="te-preview" data-theme={base} style={vars}>
            <div className="te-pv-side">
              <span className="te-pv-brand"><A.Mark size={16} /> {name || "Theme"}</span>
              <A.NavItem icon="layers" label="All items" count={38} active />
              <A.NavItem icon="star" label="Favorites" count={4} />
              <A.NavItem icon="radar" label="Watchtower" badge={{ tone: "warning", text: "6" }} />
            </div>
            <div className="te-pv-main">
              <A.ItemRow title="GitHub" subtitle="aarav-m" time="2m" active favorite />
              <A.ItemRow title="Stripe live key" subtitle="Stripe" icon="key-round" time="2d" />
              <div className="te-pv-actions"><A.Button size="sm" variant="primary">Save</A.Button><A.Button size="sm">Cancel</A.Button><A.Badge tone="success" dot>Synced</A.Badge><A.Badge tone="danger">Exposed</A.Badge></div>
            </div>
          </div>
          <div className="te-checks">
            {checks.map((x) => {
              const r = contrast(x.a, x.b);
              const ok = r >= x.min;
              const fixedR = x.fixed ? contrast(x.fixed, x.b) : null;
              return (
                <div key={x.label} className="te-check">
                  <span className="te-pair"><i style={{ background: x.b }}><b style={{ background: x.a }} /></i></span>
                  <span className="grow">{x.label}</span>
                  <span className="mono-small">{r.toFixed(2)}</span>
                  {ok ? <A.Badge size="sm" tone="success">Pass</A.Badge> : x.fixed && fixedR >= x.min ? <A.Tooltip label={"Adjusted to " + x.fixed + " (" + fixedR.toFixed(2) + ")"}><A.Badge size="sm" tone="accent">Auto-fixed</A.Badge></A.Tooltip> : <A.Badge size="sm" tone="warning">Low</A.Badge>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </A.Dialog>
  );
}

register("theme-editor", ThemeEditor);
