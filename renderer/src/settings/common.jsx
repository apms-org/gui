import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { Cli } from "../ui/kit.jsx";

const cx = U.cx;

export function Card({ title, description, actions, children, footer, footNote, danger, flush, className, id, cli }) {
  return (
    <section className={cx("card", danger && "is-danger", className)} id={id}>
      {(title || actions) && (
        <div className="card-head">
          <div className="card-head-text">
            {title && <h3 className="card-title">{title}</h3>}
            {description && <p className="card-desc">{description}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children != null && <div className={cx("card-body", flush && "is-flush")}>{children}</div>}
      {(footer || footNote || cli) && (
        <div className="card-foot">
          <span className="card-foot-note">{footNote}{cli && <Cli cmd={cli} />}</span>
          {footer && <div className="card-foot-actions">{footer}</div>}
        </div>
      )}
    </section>
  );
}

export function Head({ title, description, actions, badge, cli }) {
  return (
    <header className="set-head">
      <div className="set-head-text">
        <h1 className="set-title">{title}{badge}</h1>
        {description && <p className="set-desc">{description}</p>}
        {cli && <div className="set-cli"><Cli cmd={cli} /></div>}
      </div>
      {actions && <div className="set-actions">{actions}</div>}
    </header>
  );
}

export function useNow(ms) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms || 1000); return () => clearInterval(t); }, [ms]);
  return now;
}

export const left = (ms) => {
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  if (m < 1) return Math.ceil(ms / 1000) + "s left";
  if (m < 60) return m + "m left";
  const h = Math.floor(m / 60);
  if (h < 48) return h + "h " + (m % 60) + "m left";
  return Math.floor(h / 24) + " days left";
};

export function Steps({ items }) {
  return (
    <ol className="howto">
      {items.map((x, i) => <li key={i}><span className="howto-n">{i + 1}</span><div className="howto-body">{x}</div></li>)}
    </ol>
  );
}

export function Status({ tone, children, pulse }) {
  return <span className={cx("status", "is-" + (tone || "neutral"))}><i className={cx(pulse && "is-pulse")} />{children}</span>;
}

export function Masked({ value, keep = 4, reveal }) {
  const [on, setOn] = React.useState(false);
  const v = String(value || "");
  return (
    <span className="masked">
      <span className="mono">{on || reveal ? v : "•".repeat(Math.min(24, Math.max(8, v.length - keep))) + v.slice(-keep)}</span>
      <A.IconButton icon={on ? "eye-off" : "eye"} label={on ? "Hide" : "Reveal"} size="xs" onClick={() => setOn(!on)} />
      <A.IconButton icon="copy" label="Copy" size="xs" onClick={() => { A.copyText(v); }} />
    </span>
  );
}
