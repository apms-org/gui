import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act, MCP_EXPIRY } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { Card, Head, useNow, left } from "./common.jsx";
import { HARNESS_LOGOS } from "./harness-logos.js";

const cx = U.cx;
export const TOOL_GROUPS = [
  { id: "read", label: "Read", risk: "low", desc: "See names and structure, never secrets.", tools: ["list_vault", "search_vault"] },
  { id: "secrets", label: "Secrets", risk: "high", desc: "Read secret values and one-time codes.", tools: ["get_entry", "decrypt_entry", "get_totp"] },
  { id: "write", label: "Write", risk: "high", desc: "Ask to add, change or delete. You approve every change.", tools: ["add_entry", "edit_entry", "delete_entry", "manage_spaces", "cloud_sync"] },
  { id: "admin", label: "Admin", risk: "medium", desc: "Profiles, cloud settings, history and audit logs.", tools: ["manage_profiles", "cloud_config", "get_history", "get_audit_logs"] },
  { id: "utility", label: "Utility", risk: "low", desc: "Password generation and pending requests.", tools: ["generate_password", "tx_list", "tx_abort"] }
];
const ALL_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);
const RISK_TONE = { low: "success", medium: "warning", high: "danger" };
const PICKER_MAX = 5;
const OP_ICON = { add_entry: "plus", edit_entry: "pencil", delete_entry: "trash-2", connect: "plug", get_entry: "key-round", decrypt_entry: "key-round", get_totp: "timer", search_vault: "search" };
const VIA = { touchid: "with Touch ID", click: "with a click", keyboard: "with the keyboard", dialog: "in a dialog", app: "in the app" };
const READ_OPS = ["get_entry", "decrypt_entry", "get_totp", "search_vault"];
const EXPIRY_LABEL = { 5: "5 minutes", 15: "15 minutes", 30: "30 minutes", 60: "1 hour" };
const STATUS = {
  approved: ["Approved", "accent"], applying: ["Applying", "accent"], committed: ["Done", "success"],
  rejected: ["Rejected", "danger"], aborted: ["Cancelled", "neutral"], failed: ["Failed", "danger"], expired: ["Expired", "neutral"]
};

const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
const since = (ts, now) => { const a = U.ago(ts, now); return a === "now" ? "just now" : /^\d/.test(a) ? a + " ago" : a; };
const lastUsed = (ts, now) => (ts ? "Last used " + since(ts, now) : "Never used");
const isPending = (t, now) => t.status === "pending" && (!t.expires || t.expires > now);
const quoted = (v) => "“" + v + "”";
const entryName = (t) => (t.entry && t.entry.name) || "";
const searchQuery = (t) => (t.entry && t.entry.f && t.entry.f.query) || "";
function txTitle(t) {
  if (t.op === "connect") return "Connect " + (t.client || "an assistant");
  if ((t.op === "get_entry" || t.op === "decrypt_entry") && entryName(t)) return "Read " + quoted(entryName(t));
  if (t.op === "get_totp" && entryName(t)) return "2FA code for " + quoted(entryName(t));
  if (t.op === "search_vault") return searchQuery(t) ? "Search " + quoted(searchQuery(t)) : "Search the vault";
  return t.summary || t.op;
}
// Asking to connect or to read is allowed or not; changes are approved or rejected.
const asksToUse = (t) => t.op === "connect" || READ_OPS.includes(t.op);
const touchIdAvailable = (status, disk) => !!((status && status.touchId && status.touchId.available) || (disk && disk.auth.touchIdAvailable));
// "always", "hour" while a timed bypass runs, otherwise "ask".
const bypassMode = (x, now) => (x.bypass === "always" ? "always" : x.bypassUntil > now ? "hour" : "ask");
const minsLeft = (until, now) => Math.max(1, Math.ceil((until - now) / 60000));

function Scopes({ perms }) {
  const groups = TOOL_GROUPS.filter((g) => g.tools.some((x) => perms.includes(x)));
  if (!groups.length) return <span className="ai-scopes"><span className="scope">No tools</span></span>;
  return <span className="ai-scopes">{groups.map((g) => <span key={g.id} className={cx("scope", "is-" + g.risk)}>{g.label} <b>{g.tools.filter((x) => perms.includes(x)).length}</b></span>)}</span>;
}

export function AiAccess() {
  const disk = useStore((s) => s.disk);
  const status = useStore((s) => s.status);
  const mcp = disk.mcp;
  const tid = touchIdAvailable(status, disk);
  const now = useNow(1000);
  const [list, setList] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const load = React.useCallback(async (fresh) => {
    setErr(null);
    const r = await act.mcpHarnesses(fresh);
    if (r.ok) setList(r.harnesses); else setErr(r);
  }, []);
  React.useEffect(() => { load(false); }, [load]);
  const nameOf = (id) => { const h = list && list.find((x) => x.id === id); return h ? h.name : id; };
  return (
    <>
      <Head title="MCP" description="Let AI assistants use your vault through MCP. You allow each assistant once, and you approve every change it makes." cli="pm mcp add" />
      {mcp.policy.paused && <PausedCallout />}
      <ConnectCard list={list} err={err} onRetry={() => load(true)} />
      <AssistantsCard mcp={mcp} now={now} nameOf={nameOf} />
      <PolicyCard policy={mcp.policy} tid={tid} />
      <RequestsCard mcp={mcp} now={now} tid={tid} />
      {mcp.tokens.length > 0 && <TokensCard tokens={mcp.tokens} now={now} />}
    </>
  );
}

function HarnessLogo({ id, name }) {
  let L = HARNESS_LOGOS[id];
  if (L && L.same) L = HARNESS_LOGOS[L.same];
  if (!L) return <span className="ai-logo is-mono">{String(name || id || "?").trim().charAt(0).toUpperCase()}</span>;
  if (L.img) return <img className="ai-logo" src={L.img} width={16} height={16} alt="" draggable={false} />;
  if (L.mask) return <span className="ai-logo is-mask" style={{ WebkitMaskImage: "url(" + L.mask + ")", maskImage: "url(" + L.mask + ")" }} />;
  return (
    <svg className="ai-logo" viewBox={L.vb} width={16} height={16} fill={L.color || "currentColor"} focusable="false">
      {L.d ? <path d={L.d} /> : L.nodes.map(([tag, attrs], i) => React.createElement(tag, Object.assign({ key: i }, attrs)))}
    </svg>
  );
}

// The 5 most used assistants (the list comes in that order) as segments, the rest under More.
// Shows fewer before More when the names, and the one picked from More, don't fit the card. Labels are never cut.
function AssistantPicker({ list, value, onChange }) {
  const ref = React.useRef(null);
  const [n, setN] = React.useState(() => Math.min(list.length, PICKER_MAX));
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = document.createElement("canvas").getContext("2d");
    const fit = () => {
      const opt = el.querySelector(".apm-seg-opt");
      const seg = el.querySelector(".apm-seg");
      if (!opt || !seg || !el.clientWidth) return;
      const cs = getComputedStyle(opt);
      ctx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      const tw = (t) => ctx.measureText(t).width;
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const gap = parseFloat(cs.columnGap) || 6;
      const frame = parseFloat(getComputedStyle(seg).paddingLeft) * 2 + 4;
      const one = (x) => pad + 16 + gap + tw(x.name);
      // More shows "More", or the logo and name picked from it, then a 14px chevron.
      const more = (rest) => { const p = rest.find((x) => x.id === value); return pad + (p ? 16 + gap + tw(p.name) : tw("More")) + gap + 14; };
      const width = (k) => list.slice(0, k).reduce((w, x) => w + one(x), frame) + (k < list.length ? more(list.slice(k)) : 0);
      const tries = [];
      if (list.length <= PICKER_MAX + 1) tries.push(list.length);
      for (let k = Math.min(PICKER_MAX, list.length - 1); k >= 1; k--) tries.push(k);
      const k = tries.find((t) => width(t) <= el.clientWidth);
      setN(k || 1);
    };
    fit();
    let live = true;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (live) fit(); });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el);
    return () => { live = false; if (ro) ro.disconnect(); };
  }, [list, value]);
  const opt = (x) => ({ value: x.id, label: x.name, media: <HarnessLogo id={x.id} name={x.name} /> });
  const rest = list.slice(n);
  return (
    <div ref={ref} className="ai-picker">
      <A.SegmentedControl label="Assistant" value={value} onChange={onChange} options={list.slice(0, n).map(opt)} more={rest.length ? rest.map(opt) : undefined} moreWidth={232} />
    </div>
  );
}

function ConnectCard({ list, err, onRetry }) {
  const [pick, setPick] = React.useState(() => act.lastHarness());
  const [linkFailed, setLinkFailed] = React.useState(null);
  const h = list && (list.find((x) => x.id === pick) || list[0]);
  const choose = (id) => { setPick(id); setLinkFailed(null); act.setLastHarness(id); };
  const openLink = async () => {
    const r = await act.openLink(h.url);
    if (r.ok) { setLinkFailed(null); ui.toast({ title: "Opened " + h.name, description: "Confirm the install there, then come back.", icon: "external-link", tone: "neutral" }); }
    else setLinkFailed(h.id);
  };
  if (err) {
    return (
      <Card title="Connect an assistant">
        <A.EmptyState icon="plug" title="Can't list assistants" action={<A.Button size="sm" icon="refresh-cw" onClick={onRetry}>Try again</A.Button>}>
          {err.code === "unsupported" ? "This version of pm doesn't know the assistant list yet." : err.error} Run <span className="mono-inline">pm mcp add</span> in a terminal to connect one.
        </A.EmptyState>
      </Card>
    );
  }
  if (!list) {
    return <Card title="Connect an assistant"><div className="ai-loading muted small"><A.Spinner size={14} />Loading assistants</div></Card>;
  }
  if (!list.length) {
    return <Card title="Connect an assistant"><div className="apm-card-empty">No assistants to set up. Run <span className="mono-inline">pm mcp add</span> in a terminal.</div></Card>;
  }
  const restart = h.restart === true ? "Restart " + h.name + "." : typeof h.restart === "string" ? h.restart.trim() : "";
  const steps = [];
  if (h.kind === "deeplink" && h.url) {
    steps.push(
      <div className="stack-8">
        <span>Add APM to {h.name} in one click.</span>
        <div className="ai-actions"><A.Button size="sm" variant="primary" icon="external-link" onClick={openLink}>Add to {h.name}</A.Button></div>
        {linkFailed === h.id && <>
          <A.Hint icon="info">APM can't open {h.name} links. Copy the link into your browser, or run the command below.</A.Hint>
          <A.CodeBlock label="Install link" wrap>{h.url}</A.CodeBlock>
        </>}
        {h.command && <><span className="muted small">Or run this in a terminal.</span><A.CodeBlock label="Terminal" wrap>{h.command}</A.CodeBlock></>}
      </div>
    );
  } else {
    steps.push(
      <div className="stack-8">
        <span>{h.kind === "file" ? "Run this in a terminal. pm adds APM to " + h.name + "'s settings." : "Run this in a terminal."}</span>
        <A.CodeBlock label="Terminal" wrap>{h.command || "pm mcp add " + h.id}</A.CodeBlock>
      </div>
    );
  }
  if (restart) steps.push(<span>{restart}</span>);
  steps.push(<span>The first time {h.name} starts APM, you'll be asked to allow it.</span>);
  return (
    <Card title="Connect an assistant" description="Pick the app you use. APM shows the one step it needs."
      footNote={<span>Or run <span className="mono-inline">pm mcp add</span> in a terminal and pick {h.name}.</span>}>
      <div className="stack-16">
        <AssistantPicker list={list} value={h.id} onChange={choose} />
        <div className="ai-setup">
          <A.StepList items={steps} />
          {h.notes && <p className="help">{h.notes}</p>}
        </div>
      </div>
    </Card>
  );
}

function PausedCallout() {
  const [busy, setBusy] = React.useState(false);
  const resume = async () => {
    setBusy(true);
    const r = await act.mcpPolicy({ paused: false });
    setBusy(false);
    if (r.ok) ui.toast({ title: "MCP resumed", description: "Assistants can use your vault again." });
  };
  return (
    <A.Callout tone="warning" icon="circle-pause" className="ai-paused" title="MCP is paused"
      action={<A.Button size="sm" loading={busy} onClick={resume}>Resume</A.Button>}>
      Assistants can't read or change anything until you resume.
    </A.Callout>
  );
}

function setBypass(x, mode) {
  const go = async () => {
    const r = await act.assistantBypass(x.id, mode);
    if (!r.ok) return;
    if (mode === "always") ui.toast({ title: x.name + " can change items without asking", description: "Turn it off under Changes on its row.", icon: "zap" });
    else if (mode === "hour") ui.toast({ title: "Changes from " + x.name + " allowed for 1 hour", description: "Then it asks again.", icon: "timer" });
    else ui.toast({ title: x.name + " asks before every change", tone: "neutral" });
  };
  if (mode !== "always") return go();
  ui.open("confirm", {
    title: "Always allow " + x.name + "?", description: x.name + " will add, change and delete items without asking you. Reads and connect requests still follow your settings.",
    icon: "triangle-alert", tone: "danger", confirm: "Always allow", onConfirm: go
  });
}

function BypassBadge({ x, now }) {
  const mode = bypassMode(x, now);
  if (mode === "ask") return null;
  return <A.Badge size="sm" tone="warning" icon="zap">{mode === "always" ? "Changes allowed without asking" : "Changes allowed for " + minsLeft(x.bypassUntil, now) + " min"}</A.Badge>;
}

function BypassMenu({ x, now }) {
  const mode = bypassMode(x, now);
  return (
    <A.Menu align="end" width={240} label={"Changes from " + x.name}
      trigger={<A.Button size="sm" iconRight="chevron-down">Changes</A.Button>}
      items={[
        { section: "Changes from " + x.name },
        { label: "Ask every time", checked: mode === "ask", onSelect: () => { if (mode !== "ask") setBypass(x, "ask"); } },
        { label: "Allow for 1 hour", hint: mode === "hour" ? minsLeft(x.bypassUntil, now) + " min left" : undefined, checked: mode === "hour", onSelect: () => setBypass(x, "hour") },
        { label: "Always allow", checked: mode === "always", onSelect: () => { if (mode !== "always") setBypass(x, "always"); } }
      ]} />
  );
}

function AssistantsCard({ mcp, now, nameOf }) {
  const list = mcp.assistants.slice().sort((a, b) => (b.lastUsed || b.created) - (a.lastUsed || a.created));
  const revoke = (x) => ui.open("confirm", {
    title: "Revoke " + x.name + "?", description: x.name + " loses access on its next request. To use it again, allow it when it asks.", icon: "circle-x", tone: "danger", confirm: "Revoke",
    onConfirm: async () => { const r = await act.assistantRevoke(x.id); if (r.ok) ui.toast({ title: "Revoked " + x.name, tone: "neutral" }); }
  });
  return (
    <Card title="Assistants" description="Assistants you allowed. Each one can use only the tools you give it." flush
      actions={list.length ? <span className="muted small">{plural(list.length, "assistant")}</span> : null}>
      {list.length === 0 && <div className="apm-card-empty">No assistants yet. Connect one above.</div>}
      {list.map((x) => (
        <A.SettingRow key={x.id} icon="bot" className="ai-row"
          title={<span className="ai-title"><span className="ellipsis">{x.name}</span>{x.harness && nameOf(x.harness) !== x.name && <A.Badge size="sm" outline>{nameOf(x.harness)}</A.Badge>}</span>}
          description={<span className="ai-desc"><span>{lastUsed(x.lastUsed, now)} · {plural(x.uses, "use")}</span><Scopes perms={x.perms} /><BypassBadge x={x} now={now} /></span>}>
          {mcp.policy.known && <BypassMenu x={x} now={now} />}
          <A.Button size="sm" onClick={() => ui.open("mcp-perms", { id: x.id })}>Edit permissions</A.Button>
          <A.Button size="sm" variant="ghost" onClick={() => revoke(x)}>Revoke</A.Button>
        </A.SettingRow>
      ))}
    </Card>
  );
}

function PolicyCard({ policy: p, tid }) {
  const off = !p.known;
  const set = async (patch, done) => { const r = await act.mcpPolicy(patch); if (r.ok && done) ui.toast(done); };
  const pause = (v) => set({ paused: v }, v ? { title: "MCP paused", description: "Assistants can't read or change anything until you resume.", icon: "circle-pause", tone: "neutral" } : { title: "MCP resumed", description: "Assistants can use your vault again." });
  return (
    <Card title="Settings" description="How assistants ask you, and what a new one gets. Loosening a setting needs the vault unlocked." flush cli="pm mcp settings"
      footNote={off ? "This version of pm doesn't have MCP settings yet. Update pm to change them." : null}>
      <A.SettingRow title="Pause MCP" description="Assistants can't read or change anything until you resume.">
        <A.Switch label="Pause MCP" checked={p.paused} disabled={off} onChange={pause} />
      </A.SettingRow>
      <A.SettingRow title="Approve with" description={tid ? "With Touch ID only, a click or Space can't approve. Reject always works." : "This Mac has no Touch ID, so a click or Space approves. Reject always works."}>
        <A.SegmentedControl label="Approve with" value={tid ? p.approveWith : "any"} onChange={(v) => { if (!off && v !== p.approveWith) set({ approveWith: v }); }}
          options={[{ value: "any", label: "Touch ID or click", disabled: off }, { value: "touchid", label: "Touch ID only", disabled: off || !tid, title: tid ? undefined : "This Mac has no Touch ID." }]} />
      </A.SettingRow>
      <A.SettingRow title="Requests expire after" description="How long a change waits for you. Connect and read requests wait 2 minutes." htmlFor="mcp-expiry">
        <A.Select id="mcp-expiry" size="sm" value={String(p.expiryMinutes)} disabled={off} onChange={(v) => set({ expiryMinutes: Number(v) })} options={MCP_EXPIRY.map((m) => ({ value: String(m), label: EXPIRY_LABEL[m] }))} />
      </A.SettingRow>
      <A.SettingRow title="New assistants" description="Don't allow refuses assistants you haven't allowed yet, without asking.">
        <A.SegmentedControl label="New assistants" value={p.newAssistants} onChange={(v) => { if (!off && v !== p.newAssistants) set({ newAssistants: v }); }}
          options={[{ value: "ask", label: "Ask me", disabled: off }, { value: "block", label: "Don't allow", disabled: off }]} />
      </A.SettingRow>
      <A.SettingRow title="Ask before reading secrets" description="Assistants ask each time they open an item's secrets, get a 2FA code or search.">
        <A.Switch label="Ask before reading secrets" checked={p.askBeforeSecrets} disabled={off} onChange={(v) => set({ askBeforeSecrets: v })} />
      </A.SettingRow>
      <A.SettingRow title="Default permissions for new assistants" className="ai-row"
        description={<span className="ai-desc"><span>What an assistant can call when you first allow it.</span><Scopes perms={p.defaultPerms} /></span>}>
        <A.Button size="sm" disabled={off} onClick={() => ui.open("mcp-perms", { defaults: true })}>Edit</A.Button>
      </A.SettingRow>
    </Card>
  );
}

function RequestsCard({ mcp, now, tid }) {
  const pending = mcp.tx.filter((t) => isPending(t, now)).sort((a, b) => a.created - b.created);
  const past = mcp.tx.filter((t) => !isPending(t, now)).sort((a, b) => b.created - a.created).slice(0, 8);
  const [busy, setBusy] = React.useState({});
  const decide = async (t, approve) => {
    setBusy(Object.assign({}, busy, { [t.id]: approve ? "approve" : "reject" }));
    const r = await act.txDecide(t.id, approve);
    setBusy((b) => { const n = Object.assign({}, b); delete n[t.id]; return n; });
    if (!r.ok) return;
    if (!approve) ui.toast({ title: "Rejected", description: (t.client || "The assistant") + " was told no.", tone: "neutral" });
    else if (t.op === "connect") ui.toast({ title: "Allowed " + (t.client || "the assistant"), description: "It can use your vault now." });
    else if (READ_OPS.includes(t.op)) ui.toast({ title: "Allowed", description: txTitle(t) });
    else ui.toast({ title: "Approved", description: r.status === "committed" || !r.status ? t.summary : "APM makes the change once the vault can be edited." });
  };
  return (
    <Card title="Requests" description={"Assistants ask before they connect or change anything" + (mcp.policy.askBeforeSecrets ? ", and before they read secrets" : "") + ". Answer in the APM prompt or here. Changes expire after " + EXPIRY_LABEL[mcp.policy.expiryMinutes] + "."} flush
      actions={pending.length ? <A.Status tone="accent" pulse>{pending.length} waiting</A.Status> : null}>
      {pending.length === 0 && past.length === 0 && <div className="apm-card-empty">No requests yet.</div>}
      {pending.map((t) => (
        <A.SettingRow key={t.id} icon={OP_ICON[t.op] || "bot"} className={cx("ai-row", "is-pending", t.op === "delete_entry" && "is-danger")}
          title={<span className="ellipsis">{txTitle(t)}</span>}
          description={<span>{t.op === "connect" ? "AI assistant" : t.client} · asked {since(t.created, now)}{t.expires ? <> · <span className="tnum">{left(t.expires - now)}</span></> : null}</span>}>
          {t.approveWith === "touchid" && tid && <span className="ai-tid"><A.Icon name="fingerprint" size={14} />Touch ID required</span>}
          <A.Button size="sm" loading={busy[t.id] === "reject"} disabled={!!busy[t.id]} onClick={() => decide(t, false)}>Reject</A.Button>
          {!(t.approveWith === "touchid" && tid) && <A.Button size="sm" variant={t.op === "delete_entry" ? "danger" : "primary"} loading={busy[t.id] === "approve"} disabled={!!busy[t.id]} onClick={() => decide(t, true)}>Approve</A.Button>}
        </A.SettingRow>
      ))}
      {pending.length > 0 && past.length > 0 && <div className="apm-card-label">Recent</div>}
      {past.map((t) => {
        const st = t.status === "pending" ? "expired" : t.status;
        const [label, tone] = STATUS[st] || [st, "neutral"];
        const decided = st === "rejected" || st === "approved" || st === "committed" || st === "failed" || st === "applying";
        const how = decided && t.decidedVia === "bypass" && st !== "rejected" ? "Auto-approved"
          : decided && VIA[t.decidedVia] ? (st === "rejected" ? (asksToUse(t) ? "Not allowed " : "Rejected ") : asksToUse(t) ? "Allowed " : "Approved ") + VIA[t.decidedVia] : null;
        return (
          <A.SettingRow key={t.id} icon={OP_ICON[t.op] || "bot"} className="ai-row is-past"
            title={<span className="ellipsis">{txTitle(t)}</span>}
            description={<span className="ai-desc">
              <span>{[t.op === "connect" ? null : t.client, how, since(t.decided || t.created, now)].filter(Boolean).join(" · ")}{t.receipt ? <> · <span className="mono-small">{t.receipt}</span></> : null}</span>
              {t.error && <span className="ai-error">{t.error}</span>}
            </span>}>
            <A.Badge size="sm" tone={tone}>{asksToUse(t) && (st === "committed" || st === "approved") ? "Allowed" : asksToUse(t) && st === "rejected" ? "Not allowed" : label}</A.Badge>
          </A.SettingRow>
        );
      })}
    </Card>
  );
}

function TokensCard({ tokens, now }) {
  const revoke = (t) => ui.open("confirm", {
    title: "Revoke " + t.name + "?", description: "It can't start pm mcp serve again. If it is connected now, it keeps access until it restarts.", icon: "circle-x", tone: "danger", confirm: "Revoke token",
    onConfirm: async () => { const r = await act.tokenRevoke(t.id); if (r.ok) ui.toast({ title: "Revoked " + t.name, tone: "neutral" }); }
  });
  return (
    <Card title="Legacy tokens" description="Tokens still work. New assistants connect without one." flush cli="pm mcp token">
      {tokens.map((t) => {
        const expired = !!(t.expires && t.expires < now);
        return (
          <A.SettingRow key={t.id} icon="key-round" className={cx("ai-row", expired && "is-dead")}
            title={<span className="ai-title"><span className="ellipsis">{t.name}</span>{t.prefix && <span className="mono-small muted">{t.prefix}…</span>}{expired && <A.Badge size="sm" tone="danger">Expired</A.Badge>}</span>}
            description={<span className="ai-desc"><span>{lastUsed(t.lastUsed, now)} · {plural(t.uses || 0, "use")} · {t.expires ? (expired ? "expired " + U.ago(t.expires, now) : left(t.expires - now)) : "no expiry"}</span><Scopes perms={t.perms || []} /></span>}>
            <A.Button size="sm" variant="ghost" onClick={() => revoke(t)}>Revoke</A.Button>
          </A.SettingRow>
        );
      })}
    </Card>
  );
}

function PermsDialog({ id, defaults, onClose }) {
  const disk = useStore((s) => s.disk);
  const x = !disk ? null : defaults ? { id: "", name: "New assistants", perms: disk.mcp.policy.defaultPerms } : disk.mcp.assistants.find((a) => a.id === id);
  const [perms, setPerms] = React.useState(() => (x ? x.perms.slice() : []));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => { if (!x) onClose(); }, [x]);
  if (!x) return null;
  const has = (t) => perms.includes(t);
  const toggle = (t, on) => setPerms(on ? Array.from(new Set(perms.concat([t]))) : perms.filter((y) => y !== t));
  const group = (g, on) => setPerms(on ? Array.from(new Set(perms.concat(g.tools))) : perms.filter((y) => !g.tools.includes(y)));
  const changed = perms.length !== x.perms.length || perms.some((t) => !x.perms.includes(t));
  const known = perms.filter((t) => ALL_TOOLS.includes(t)).length;
  const save = async () => {
    setBusy(true); setErr(null);
    const r = defaults ? await act.mcpPolicy({ defaultPerms: perms }) : await act.assistantPerms(x.id, perms);
    setBusy(false);
    if (!r.ok) { if (!defaults) setErr(r.error); return; }
    ui.toast({ title: defaults ? "Saved default permissions" : "Saved permissions for " + x.name });
    onClose();
  };
  return (
    <A.Dialog open onClose={onClose} size="lg" icon={defaults ? "mcp" : "bot"} title={defaults ? "Default permissions" : "Permissions for " + x.name}
      description={defaults ? "The tools an assistant can call when you first allow it. Change them for each assistant later." : "Choose the tools it can call. It still asks you before every change."}
      footerStart={<span className="muted small">{known} of {ALL_TOOLS.length} tools</span>}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={!changed} onClick={save}>Save</A.Button></>}>
      <div className="stack-16">
        <div className="toolgroups">
          {TOOL_GROUPS.map((g) => {
            const n = g.tools.filter(has).length;
            return (
              <div key={g.id} className="toolgroup">
                <div className="toolgroup-head">
                  <div className="toolgroup-text">
                    <span className="toolgroup-title">{g.label}<A.Badge size="sm" tone={RISK_TONE[g.risk]}>{g.risk} risk</A.Badge></span>
                    <span className="toolgroup-desc">{g.desc}</span>
                  </div>
                  <span className="toolgroup-count muted small">{n} of {g.tools.length}</span>
                  <A.Switch label={g.label + " tools"} checked={n === g.tools.length} onChange={(v) => group(g, v)} />
                </div>
                <div className="toolgroup-tools">
                  {g.tools.map((t) => <A.Checkbox key={t} checked={has(t)} onChange={(v) => toggle(t, v)} label={<span className="mono-small">{t}</span>} />)}
                </div>
              </div>
            );
          })}
        </div>
        {perms.some((t) => TOOL_GROUPS[1].tools.includes(t)) && <A.Callout tone="warning" title={x.name + " can read secret values"}>Only give secrets access to assistants you run on this Mac. Every read is written to the audit log.</A.Callout>}
        {err && <A.Hint tone="danger" icon="triangle-alert">{err}</A.Hint>}
      </div>
    </A.Dialog>
  );
}

register("mcp-perms", PermsDialog);
