import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { store, A as act } from "../lib/store.js";
import { copied } from "./fields.jsx";

const cx = U.cx;
const OPT_KEY = "apm-desktop-gen";
const readOpts = () => { try { return Object.assign({ mode: "random", length: 20, upper: true, lower: true, digits: true, symbols: true, avoidAmbiguous: false, words: 5, separator: "-", capitalize: true, number: true, pinLength: 6 }, JSON.parse(localStorage.getItem(OPT_KEY) || "{}")); } catch (e) { return { mode: "random", length: 20, upper: true, lower: true, digits: true, symbols: true, avoidAmbiguous: false, words: 5, separator: "-", capitalize: true, number: true, pinLength: 6 }; } };
const history = [];

export function Colorized({ value, className }) {
  return <span className={cx("colorized", className)}>{Array.from(String(value)).map((c, i) => <span key={i} className={/[0-9]/.test(c) ? "d" : /[^A-Za-z0-9]/.test(c) ? "s" : undefined}>{c}</span>)}</span>;
}

export function GeneratorPanel({ onUse, compact, useLabel = "Use password" }) {
  const [o, setO] = React.useState(readOpts);
  const [value, setValue] = React.useState(() => U.generate(readOpts()));
  const [spin, setSpin] = React.useState(0);
  const set = (patch) => { const n = Object.assign({}, o, patch); setO(n); try { localStorage.setItem(OPT_KEY, JSON.stringify(n)); } catch (e) {} setValue(U.generate(n)); setSpin(spin + 1); };
  const regen = () => { setValue(U.generate(o)); setSpin(spin + 1); };
  const s = U.strength(value);
  const use = () => { history.unshift({ v: value, ts: Date.now() }); if (history.length > 8) history.length = 8; if (store.get().disk) act.audit("PASSWORD_GENERATED", o.mode === "random" ? o.length + " characters" : o.mode === "pin" ? o.pinLength + "-digit PIN" : o.words + "-word passphrase"); onUse && onUse(value); };
  return (
    <div className={cx("gen", compact && "is-compact")}>
      <div className="gen-out">
        <div className="gen-value" key={spin}><Colorized value={value} /></div>
        <div className="gen-out-actions">
          <A.IconButton icon="refresh-cw" label="Generate another" kbd="R" onClick={regen} />
          <A.IconButton icon="copy" label="Copy" onClick={() => copied("password", value, true, (store.get().disk || { settings: {} }).settings.clipboard)} />
        </div>
      </div>
      <div className="gen-strength"><A.StrengthMeter key={spin} score={s.score} bits={s.bits} detail={U.crackPhrase(s.bits)} /></div>
      <A.SegmentedControl label="Kind" options={[{ value: "random", label: "Random" }, { value: "passphrase", label: "Passphrase" }, { value: "pin", label: "PIN" }]} value={o.mode} onChange={(v) => set({ mode: v })} />
      {o.mode === "random" && <>
        <div className="slider-row"><label htmlFor="gen-len">Length</label><A.Slider id="gen-len" label="Length" min={8} max={64} value={o.length} onChange={(v) => set({ length: v })} /><span className="mono">{o.length}</span></div>
        <div className="gen-toggles">
          <A.Checkbox checked={o.upper} onChange={(v) => set({ upper: v })} label="A-Z" />
          <A.Checkbox checked={o.lower} onChange={(v) => set({ lower: v })} label="a-z" />
          <A.Checkbox checked={o.digits} onChange={(v) => set({ digits: v })} label="0-9" />
          <A.Checkbox checked={o.symbols} onChange={(v) => set({ symbols: v })} label="!@#$" />
        </div>
        <A.Checkbox checked={o.avoidAmbiguous} onChange={(v) => set({ avoidAmbiguous: v })} label="Avoid look-alikes" description="Leaves out I, l, 1, O, 0 and quote marks" />
      </>}
      {o.mode === "passphrase" && <>
        <div className="slider-row"><label htmlFor="gen-words">Words</label><A.Slider id="gen-words" label="Words" min={3} max={10} value={o.words} onChange={(v) => set({ words: v })} /><span className="mono">{o.words}</span></div>
        <div className="gen-row">
          <A.Select size="sm" label="Separator" value={o.separator} onChange={(v) => set({ separator: v })} options={[{ value: "-", label: "Hyphen  -" }, { value: ".", label: "Period  ." }, { value: "_", label: "Underscore  _" }, { value: " ", label: "Space" }]} />
          <div className="gen-checks"><A.Checkbox checked={o.capitalize} onChange={(v) => set({ capitalize: v })} label="Capitalize" /><A.Checkbox checked={o.number} onChange={(v) => set({ number: v })} label="Add a number" /></div>
        </div>
      </>}
      {o.mode === "pin" && <div className="slider-row"><label htmlFor="gen-pin">Digits</label><A.Slider id="gen-pin" label="Digits" min={4} max={12} value={o.pinLength} onChange={(v) => set({ pinLength: v })} /><span className="mono">{o.pinLength}</span></div>}
      {onUse && <A.Button variant="primary" block icon="check" onClick={use}>{useLabel}</A.Button>}
    </div>
  );
}

export function GeneratorPopover({ onUse }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const btn = React.useRef(null);
  const pop = React.useRef(null);
  const place = () => { const r = btn.current.getBoundingClientRect(); const w = 340; const left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w)); const below = window.innerHeight - r.bottom > 430; setPos({ left, top: below ? r.bottom + 8 : Math.max(12, r.top - 438), w }); };
  React.useEffect(() => {
    if (!open) return;
    place();
    const d = (e) => { if (pop.current && !pop.current.contains(e.target) && !btn.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } if (e.key.toLowerCase() === "r" && !e.metaKey && document.activeElement && document.activeElement.tagName !== "INPUT") { const b = pop.current && pop.current.querySelector("[aria-label='Generate another']"); b && b.click(); } };
    document.addEventListener("mousedown", d); window.addEventListener("keydown", k, true); window.addEventListener("resize", place);
    return () => { document.removeEventListener("mousedown", d); window.removeEventListener("keydown", k, true); window.removeEventListener("resize", place); };
  }, [open]);
  return (
    <>
      <A.Button ref={btn} size="sm" variant="ghost" icon="dices" onClick={() => setOpen(!open)} aria-expanded={open ? "true" : "false"}>Generate</A.Button>
      {open && pos && ReactDOM.createPortal(
        <div ref={pop} className="popover" style={{ left: pos.left, top: pos.top, width: pos.w }} role="dialog" aria-label="Password generator">
          <GeneratorPanel compact onUse={(v) => { onUse(v); setOpen(false); }} />
        </div>, document.body)}
    </>
  );
}

export function GeneratorDialog({ onClose }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  return (
    <A.Dialog open onClose={onClose} title="Password generator" description="Generated locally with the system's secure random source. Nothing is saved until you use it." size="md" icon="dices"
      footerStart={<span>The CLI's <code className="mono-inline">pm gen</code> covers length only. Passphrases and PINs are app only.</span>}>
      <GeneratorPanel onUse={(v) => { copied("password", v, true, (store.get().disk || { settings: {} }).settings.clipboard); force(); }} useLabel="Copy and keep" />
      {history.length > 0 && (
        <div className="gen-history">
          <div className="gen-history-h">This session</div>
          {history.map((h, i) => <div key={i} className="gen-history-row"><Colorized value={h.v} className="mono" /><span>{U.ago(h.ts)}</span><A.IconButton icon="copy" size="xs" label="Copy" onClick={() => copied("password", h.v, true)} /></div>)}
        </div>
      )}
    </A.Dialog>
  );
}
