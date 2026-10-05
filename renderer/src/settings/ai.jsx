import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { getType } from "../lib/types.js";
import { Card, Head, Status, useNow, left } from "./common.jsx";
import { CodeBlock } from "../ui/kit.jsx";

const cx = U.cx;
export const TOOL_GROUPS = [
  { id: "read", label: "Read", risk: "low", desc: "See names and structure, never secrets.", tools: ["list_vault", "search_vault"] },
  { id: "secrets", label: "Secrets", risk: "high", desc: "Read secret values and one-time codes.", tools: ["get_entry", "decrypt_entry", "get_totp"] },
  { id: "write", label: "Write", risk: "high", desc: "Changes need your approval here first.", tools: ["add_entry", "edit_entry", "delete_entry", "manage_spaces", "cloud_sync"] },
  { id: "admin", label: "Admin", risk: "medium", desc: "Profiles, cloud settings, history and audit logs.", tools: ["manage_profiles", "cloud_config", "get_history", "get_audit_logs"] },
  { id: "utility", label: "Utility", risk: "low", desc: "Password generation and pending requests.", tools: ["generate_password", "tx_list", "tx_abort"] }
];
const ALL_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools);
const CLIENTS = [
  { name: "Claude Desktop", path: "~/Library/Application Support/Claude/claude_desktop_config.json" },
  { name: "Cursor", path: "~/.cursor/mcp.json" },
  { name: "VS Code", path: "~/Library/Application Support/Code/User/mcp.json" },
  { name: "Cline", path: "~/.cline/mcp_settings.json" }
];
const RISK_TONE = { low: "success", medium: "warning", high: "danger" };

export function AiAccess() {
  const disk = useStore((s) => s.disk);
  const mcp = disk.mcp;
  const now = useNow(1000);
  const pending = mcp.tx.filter((t) => t.status === "pending" && t.expires > now);
  const past = mcp.tx.filter((t) => t.status !== "pending" || t.expires <= now);
  return (
    <>
      <Head title="AI access" description="Let AI assistants use your vault through MCP. Each assistant gets its own token with only the tools you allow, and every change waits for your approval." cli="pm mcp serve" />
      <Card flush>
        <A.SettingRow icon="bot" title="MCP server" description={mcp.enabled ? "On. Assistants start it with pm mcp serve over stdio. Nothing listens on the network." : "Off. Tokens are kept, and the app stops showing approval requests."}>
          <A.Switch label="MCP server" checked={!!mcp.enabled} onChange={(v) => act.mcpEnabled(v)} />
        </A.SettingRow>
      </Card>
      {pending.length > 0 && (
        <div className="approvals">
          <div className="approvals-head"><Status tone="accent" pulse>{pending.length} waiting for you</Status><span className="muted small">Requests expire after 15 minutes</span></div>
          {pending.map((t) => <Approval key={t.id} t={t} now={now} />)}
        </div>
      )}
      <Card title="Access tokens" description="Revoking a token cuts that assistant off on its next call." flush cli="pm mcp token"
        actions={<A.Button size="sm" variant="primary" icon="plus" disabled={!mcp.enabled} onClick={() => ui.open("mcp-token")}>New token</A.Button>}>
        {mcp.tokens.length === 0 && <div className="card-empty">No tokens. Create one per assistant.</div>}
        {mcp.tokens.map((t) => {
          const expired = !!(t.expires && t.expires < now);
          const groups = TOOL_GROUPS.filter((g) => g.tools.some((x) => t.perms.includes(x)));
          return (
            <div key={t.id} className={cx("tok", expired && "is-dead")}>
              <A.Avatar name={t.name} size={30} />
              <div className="tok-text">
                <div className="tok-top"><b>{t.name}</b>{t.prefix && <span className="mono-small muted">{t.prefix}…</span>}{expired && <A.Badge size="sm" tone="danger">Expired</A.Badge>}</div>
                <div className="tok-scopes">{groups.map((g) => <span key={g.id} className={cx("scope", "is-" + g.risk)}>{g.label} <b>{g.tools.filter((x) => t.perms.includes(x)).length}</b></span>)}</div>
              </div>
              <div className="tok-meta"><span>{t.uses || 0} calls</span><span className="muted">{t.lastUsed ? "used " + U.ago(t.lastUsed) : "never used"}</span><span className="muted">{t.expires ? (expired ? "expired " + U.ago(t.expires) : left(t.expires - now)) : "no expiry"}</span></div>
              <A.Button size="sm" variant="ghost" onClick={() => ui.open("confirm", { title: "Revoke " + t.name + "?", description: "Its next call fails. Pending requests from it are rejected.", icon: "circle-x", tone: "danger", confirm: "Revoke token", onConfirm: async () => { const r = await act.tokenRevoke(t.id); if (r.ok) ui.toast({ title: "Revoked " + t.name, tone: "neutral" }); } })}>Revoke</A.Button>
            </div>
          );
        })}
      </Card>
      <Card title="Assistants" description="Each assistant reads its MCP servers from a config file. Create a token, then paste the entry into that file." flush cli="pm mcp config">
        {CLIENTS.map((c) => (
          <A.SettingRow key={c.name} title={c.name} description={<span className="mono-small">{c.path}</span>}>
            <A.Button size="sm" variant="secondary" disabled={!mcp.enabled} onClick={() => ui.open("mcp-token", { client: c.name })}>Set up</A.Button>
          </A.SettingRow>
        ))}
        <div className="card-pad"><CodeBlock label="Manual setup · any MCP client" maxHeight={180}>{JSON.stringify({ mcpServers: { apm: { command: "pm", args: ["mcp", "serve", "--token", "<your token>"] } } }, null, 2)}</CodeBlock></div>
      </Card>
      {past.length > 0 && (
        <Card title="Past requests" flush>
          {past.slice(0, 8).map((t) => (
            <div key={t.id} className="mini-event">
              <span className={cx("mini-event-dot", t.status === "approved" && "is-ok", t.status === "rejected" && "is-danger")} />
              <b className="small">{t.client}</b>
              <span className="grow ellipsis">{t.summary}</span>
              <A.Badge size="sm" tone={t.status === "approved" ? "success" : t.status === "rejected" ? "danger" : "neutral"}>{t.status === "pending" ? "expired" : t.status}</A.Badge>
              <span className="muted small">{U.ago(t.decided || t.expires || t.created)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function Approval({ t, now }) {
  const type = t.entry && t.entry.type ? getType(t.entry.type) : null;
  const pct = Math.max(0, (t.expires - now) / (t.expires - t.created));
  const opLabel = { add_entry: "Add", edit_entry: "Edit", delete_entry: "Delete" }[t.op] || t.op;
  return (
    <div className={cx("approval", t.op === "delete_entry" && "is-danger")}>
      <div className="approval-top">
        <A.Avatar name={t.client} size={28} />
        <div className="approval-who"><b>{t.client}</b><span className="muted small">wants to <b>{opLabel.toLowerCase()}</b> an item · {U.ago(t.created)} ago</span></div>
        <span className="grow" />
        <span className="approval-ttl mono-small">{left(t.expires - now)}</span>
      </div>
      <div className="approval-body">
        <span className="approval-op mono-small">{t.op}</span>
        <b>{t.summary}</b>
        {t.entry && t.entry.f && (
          <div className="approval-fields">
            {Object.entries(t.entry.f).map(([k, v]) => {
              const def = type && type.fields.find((x) => x.key === k);
              const secret = def && ["password", "secret", "secretBlock", "totp"].includes(def.kind);
              return <div key={k} className="kv"><div className="kv-label">{def ? def.label : k}</div><div className={cx("kv-value", (secret || (def && def.mono)) && "is-mono")}>{secret ? String(v).slice(0, 8) + "•".repeat(10) : String(v)}</div></div>;
            })}
          </div>
        )}
      </div>
      <div className="approval-foot">
        <div className="approval-bar"><i style={{ transform: "scaleX(" + pct + ")" }} /></div>
        <span className="grow" />
        <A.Button size="sm" onClick={async () => { const r = await act.txAbort(t.id); if (r.ok) ui.toast({ title: "Rejected", description: t.client + " was told no.", tone: "neutral" }); }}>Reject</A.Button>
        <A.Button size="sm" variant={t.op === "delete_entry" ? "danger" : "primary"} onClick={async () => { const r = await act.txApprove(t.id); if (r.ok) ui.toast({ title: "Approved", description: t.summary }); }}>Approve</A.Button>
      </div>
    </div>
  );
}

function TokenDialog({ client, onClose }) {
  const [name, setName] = React.useState(client || "");
  const [perms, setPerms] = React.useState(["list_vault", "search_vault", "generate_password"]);
  const [exp, setExp] = React.useState("43200");
  const [out, setOut] = React.useState(null);
  const [cfg, setCfg] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const has = (x) => perms.includes(x);
  const toggle = (x) => setPerms(has(x) ? perms.filter((y) => y !== x) : perms.concat([x]));
  const group = (g, on) => setPerms(on ? Array.from(new Set(perms.concat(g.tools))) : perms.filter((x) => !g.tools.includes(x)));
  const preset = (list) => setPerms(list);
  const create = async () => {
    setBusy(true); setErr(null);
    const r = await act.tokenCreate(name.trim(), perms, Number(exp));
    if (!r.ok) { setBusy(false); setErr(r.error); return; }
    setOut(r.token);
    const c = await act.mcpConfig(name.trim(), r.token);
    setBusy(false);
    setCfg(c.ok && c.json ? (typeof c.json === "string" ? c.json : JSON.stringify(c.json, null, 2)) : JSON.stringify({ mcpServers: { apm: { command: "pm", args: ["mcp", "serve", "--token", r.token] } } }, null, 2));
  };
  const risky = perms.some((x) => TOOL_GROUPS[1].tools.includes(x));
  const where = CLIENTS.find((c) => c.name === name.trim());
  return (
    <A.Dialog open onClose={onClose} size="lg" icon="bot" title={out ? "Token created" : "New access token"} description={out ? "Copy it now. It is not shown again." : "One token per assistant, so you can revoke them separately."}
      footerStart={!out ? <span className="muted small">{perms.length} of {ALL_TOOLS.length} tools</span> : null}
      footer={out ? <A.Button variant="primary" onClick={onClose}>Done</A.Button> : <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={!name.trim() || !perms.length} onClick={create}>Create token</A.Button></>}>
      {!out ? (
        <div className="stack-16">
          <div className="grid-2">
            <A.Input label="Assistant" value={name} onChange={(e) => setName(e.target.value)} placeholder="Claude Desktop" autoFocus />
            <A.Select label="Expires" value={exp} onChange={setExp} options={[{ value: "60", label: "In 1 hour" }, { value: "1440", label: "In 1 day" }, { value: "10080", label: "In 7 days" }, { value: "43200", label: "In 30 days" }, { value: "129600", label: "In 90 days" }, { value: "0", label: "Never" }]} />
          </div>
          <div className="presets">
            <span className="apm-label">Start from</span>
            <button type="button" className="chip" onClick={() => preset(TOOL_GROUPS[0].tools.concat(["generate_password"]))}>Browse only</button>
            <button type="button" className="chip" onClick={() => preset(TOOL_GROUPS[0].tools.concat(TOOL_GROUPS[1].tools, ["generate_password"]))}>Read secrets</button>
            <button type="button" className="chip" onClick={() => preset(TOOL_GROUPS[0].tools.concat(TOOL_GROUPS[1].tools, TOOL_GROUPS[2].tools.slice(0, 3), TOOL_GROUPS[4].tools))}>Assistant</button>
            <button type="button" className="chip" onClick={() => preset(ALL_TOOLS)}>Everything</button>
          </div>
          <div className="toolgroups">
            {TOOL_GROUPS.map((g) => {
              const n = g.tools.filter(has).length;
              return (
                <div key={g.id} className="toolgroup">
                  <div className="toolgroup-head">
                    <A.Checkbox checked={n === g.tools.length} onChange={(v) => group(g, v)} label={<span className="toolgroup-title">{g.label}<A.Badge size="sm" tone={RISK_TONE[g.risk]}>{g.risk} risk</A.Badge></span>} description={g.desc} />
                  </div>
                  <div className="toolgroup-tools">{g.tools.map((x) => <button key={x} type="button" className={cx("tool", has(x) && "is-on")} aria-pressed={has(x) ? "true" : "false"} onClick={() => toggle(x)}><A.Icon name={has(x) ? "check" : "plus"} size={11} strokeWidth={2.5} />{x}</button>)}</div>
                </div>
              );
            })}
          </div>
          {risky && <A.Callout tone="warning" title="This assistant can read secret values">Only give secrets access to assistants you run locally. Every read is written to the audit log.</A.Callout>}
          {err && <div className="apm-hint apm-hint-danger apm-hint-enter" role="alert"><A.Icon name="triangle-alert" size={14} />{err}</div>}
        </div>
      ) : (
        <div className="stack-12">
          <CodeBlock label="Token" copy={out}>{out}</CodeBlock>
          {cfg && <CodeBlock label={"Config" + (where ? " · paste into " + where.path : "")} copy={cfg} maxHeight={200}>{cfg}</CodeBlock>}
          <p className="help">Restart {name.trim() || "the assistant"} after editing its config. Write requests show up here for approval.</p>
        </div>
      )}
    </A.Dialog>
  );
}

register("mcp-token", TokenDialog);
