import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore } from "../lib/store.js";

const cx = U.cx;

export function Page({ children, width = 760, className }) {
  return (
    <div className={cx("page", className)}>
      <div className="page-inner" style={{ maxWidth: width }}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, description, actions, icon, eyebrow }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{icon && <span className="page-title-icon"><A.Icon name={icon} size={18} /></span>}{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Section({ title, description, actions, children, id }) {
  return (
    <section className="section" id={id}>
      {(title || actions) && (
        <div className="section-head">
          <div className="section-head-text">
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="section-desc">{description}</p>}
          </div>
          {actions && <div className="section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kv({ label, children, mono, copy }) {
  return (
    <div className="kv">
      <div className="kv-label">{label}</div>
      <div className={cx("kv-value", mono && "is-mono")}>{children}</div>
      {copy && <A.IconButton icon="copy" label={"Copy " + String(label).toLowerCase()} size="xs" onClick={() => { A.copyText(copy); }} />}
    </div>
  );
}

export function Stepper({ steps, current, onStep }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} className={"stepper-item is-" + state}>
            <button type="button" disabled={i > current || !onStep} onClick={() => onStep && onStep(i)} aria-current={state === "current" ? "step" : undefined}>
              <span className="stepper-dot">{state === "done" ? <A.Icon name="check" size={12} strokeWidth={2.5} /> : i + 1}</span>
              <span className="stepper-label">{s}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function CodeBlock({ children, label, copy, wrap, maxHeight }) {
  const [done, setDone] = React.useState(false);
  return (
    <div className="codeblock">
      {(label || copy !== false) && (
        <div className="codeblock-head">
          <span>{label}</span>
          {copy !== false && (
            <A.Button variant="ghost" size="sm" icon={done ? "check" : "copy"} onClick={() => { A.copyText(typeof copy === "string" ? copy : String(children)); setDone(true); setTimeout(() => setDone(false), 1400); }}>{done ? "Copied" : "Copy"}</A.Button>
          )}
        </div>
      )}
      <pre className={cx("codeblock-pre", wrap && "is-wrap")} style={maxHeight ? { maxHeight } : undefined}>{children}</pre>
    </div>
  );
}

export function StatusDot({ tone = "neutral", pulse }) {
  return <span className={cx("status-dot", "is-" + tone, pulse && "is-pulse")} aria-hidden="true" />;
}

export function Choice({ selected, onClick, icon, title, description, meta, badge, disabled, children, arrow }) {
  return (
    <button type="button" className={cx("choice", selected && "is-selected")} aria-pressed={arrow ? undefined : selected ? "true" : "false"} onClick={onClick} disabled={disabled}>
      {icon && <span className="choice-icon"><A.Icon name={icon} size={18} /></span>}
      <span className="choice-text">
        <span className="choice-title">{title}{badge}</span>
        {description && <span className="choice-desc">{description}</span>}
        {meta && <span className="choice-meta">{meta}</span>}
        {children}
      </span>
      {arrow ? <A.Icon name="chevron-right" size={16} className="choice-arrow" /> : <span className="choice-radio" aria-hidden="true">{selected && <A.Icon name="check" size={12} strokeWidth={2.75} />}</span>}
    </button>
  );
}

export function Meter({ value, tone, size = 120, stroke = 10, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => { const t = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(t); }, [value]);
  return (
    <div className={cx("meter", tone && "is-" + tone)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="meter-track" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="meter-arc" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} />
      </svg>
      <div className="meter-center">
        <span className="meter-value">{label != null ? label : value}</span>
        {sub && <span className="meter-sub">{sub}</span>}
      </div>
    </div>
  );
}

export function Pill({ children, tone }) {
  return <span className={cx("pill", tone && "is-" + tone)}>{children}</span>;
}

export function Row({ children, className, onClick, active }) {
  return <div className={cx("row-plain", onClick && "is-click", active && "is-active", className)} onClick={onClick}>{children}</div>;
}

export function ConfirmText({ word, value, onChange, id }) {
  return (
    <A.Input id={id} label={<span>Type <b className="mono-inline">{word}</b> to confirm</span>} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
  );
}

export function Split({ left, right }) {
  return <div className="split"><div>{left}</div><div>{right}</div></div>;
}

export function Cli({ cmd, className }) {
  const prefs = useStore((s) => s.prefs);
  if (prefs.showCli === false || !cmd) return null;
  return <A.Command cmd={cmd} label="Copy the pm command" className={className} />;
}
