import { A } from "../lib/ds.js";
import { Cli } from "../ui/kit.jsx";

// Settings cards and page heads are the design system's Card and PageHeader,
// with the matching pm command (hidden when "Show pm commands" is off).
export function Card({ cli, footNote, ...rest }) {
  return <A.Card {...rest} footNote={footNote || cli ? <>{footNote}{cli && <Cli cmd={cli} />}</> : null} />;
}

export function Head({ cli, ...rest }) {
  return <A.PageHeader {...rest}>{cli ? <Cli cmd={cli} /> : null}</A.PageHeader>;
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

export const lockMinutes = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

export const lockLabel = (m) => m === 0 ? "Never" : m < 60 || m % 60 ? m + (m === 1 ? " minute" : " minutes") : m / 60 + (m === 60 ? " hour" : " hours");

export const lockOptions = (list, cur) => {
  const v = lockMinutes(cur);
  const nums = list.filter(Boolean);
  if (v && !nums.includes(v)) nums.push(v);
  return nums.sort((a, b) => a - b).concat([0]).map((m) => ({ value: String(m), label: lockLabel(m) }));
};

export function lockSummary(st) {
  const idle = lockMinutes(st.inactivity);
  const max = lockMinutes(st.sessionTimeout);
  const parts = [];
  if (idle) parts.push("after " + lockLabel(idle) + " idle");
  if (max) parts.push(lockLabel(max) + " after unlocking");
  if (st.lockOnSleep) parts.push("when the Mac sleeps");
  if (!parts.length) return "Never locks on its own. Lock it yourself with ⌘L.";
  return "Locks " + (parts.length > 1 ? parts.slice(0, -1).join(", ") + " or " + parts[parts.length - 1] : parts[0]) + ".";
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
