import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { PROFILES, CIPHERS, describe } from "../lib/profiles.js";
import { activePolicy } from "../lib/types.js";
import { NewPasswordFields, passwordOk } from "../screens/auth.jsx";
import { Choice } from "../ui/kit.jsx";
import { Card, Head, Status, lockMinutes, lockSummary } from "./common.jsx";

const cx = U.cx;

export const profileOf = (meta) => {
  if (meta.profile !== "custom" && PROFILES[meta.profile]) return Object.assign({}, PROFILES[meta.profile], { cipher: meta.cipher || PROFILES[meta.profile].cipher });
  const c = meta.custom || {};
  return { name: c.name || "Custom", kdf: c.kdf || "Argon2id", time: c.time || 3, memory: c.memory || 64, threads: c.threads || 2, salt: c.saltLen || c.salt || 16, nonce: c.nonceLen || c.nonce || 12, cipher: c.cipher || meta.cipher || "AES-256-GCM" };
};
const isCustom = (m) => m.profile === "custom";
const estimate = (p) => p.kdf === "PBKDF2" ? 0.4 : Math.max(0.1, (p.time * p.memory) / (3 * 64) * 0.3);
const fmtSec = (s) => s < 1 ? "about " + (Math.round(s * 10) / 10) + "s" : "about " + (Math.round(s * 10) / 10) + "s";

export function Security() {
  const disk = useStore((s) => s.disk);
  const status = useStore((s) => s.status) || {};
  const st = disk.settings;
  const m = disk.meta;
  const P = profileOf(m);
  const tid = status.touchId || {};
  const lastPw = disk.audit.find((e) => e.action === "MASTER_PASSWORD_CHANGED" || e.action === "RECOVERY_COMPLETED" || e.action === "PASSWORD_CHANGED");
  const choose = (id) => { if (id === m.profile) return; ui.open("reencrypt", { profile: id }); };
  const touch = (v) => {
    if (!v) { ui.open("confirm", { title: "Turn off Touch ID?", description: "The Keychain entry that holds your master password is deleted. pm and the app both ask for the password again.", icon: "fingerprint", confirm: "Turn off", onConfirm: async () => { const r = await act.touchIdSet(false); if (r.ok) ui.toast({ title: "Touch ID removed", description: "The Keychain entry was deleted.", icon: "fingerprint" }); else ui.toast({ title: r.error, tone: "danger" }); } }); return; }
    ui.open("touchid-setup");
  };
  return (
    <>
      <Head title="Security" description="How the vault is unlocked, when it locks and how it is encrypted." />
      <Card title="Master password" description="The only key to this vault. APM cannot see it or reset it without a recovery method."
        footNote={lastPw ? "Last changed " + U.agoLong(lastPw.ts) : m.created ? "Not changed since the vault was created " + U.date(m.created) : "Change it any time. Recovery methods keep working."}
        cli="pm auth change" footer={<A.Button size="sm" icon="key-round" onClick={() => ui.open("change-password")} disabled={disk.readonly}>Change master password</A.Button>} />
      <Card flush cli="pm auth touchid status">
        <A.SettingRow icon="fingerprint" title="Unlock with Touch ID" description={tid.available ? "Your master password is kept in the macOS Keychain and released only after a fingerprint check. pm uses the same entry." : "Touch ID is not available on this Mac."}>
          <A.Switch label="Touch ID" checked={!!(tid.configured || disk.auth.touchId)} disabled={!tid.available} onChange={touch} />
        </A.SettingRow>
      </Card>
      <Card flush cli="pm autolock">
        <A.SettingRow icon="timer" title="Auto-lock" description={lockSummary(st) + " Set it for the app, pm and the browser extension in Sessions."}>
          {!lockMinutes(st.inactivity) && !lockMinutes(st.sessionTimeout) && <A.Badge size="sm" tone="warning" icon="triangle-alert">{st.lockOnSleep ? "Only on sleep" : "Never locks"}</A.Badge>}
          <A.Button size="sm" onClick={() => ui.go({ view: "settings", section: "sessions" })}>Change</A.Button>
        </A.SettingRow>
      </Card>
      <Card title="Clipboard" flush>
        <A.SettingRow title="Clear clipboard" description="After you copy a secret. Only clears it if it still holds what APM copied." htmlFor="clip"><A.Select id="clip" size="sm" value={String(st.clipboard)} onChange={(v) => act.settings({ clipboard: v })} options={[{ value: "10", label: "After 10 seconds" }, { value: "30", label: "After 30 seconds" }, { value: "90", label: "After 90 seconds" }, { value: "0", label: "Never" }]} /></A.SettingRow>
      </Card>
      <Card title="Encryption profile" description="How hard each guess at your master password is. Higher profiles make every guess cost more memory and time, for you and for an attacker."
        cli={"pm profile set " + (isCustom(m) ? "custom" : m.profile)} footNote={<span>Changing profile re-encrypts the whole vault. It takes a few seconds and is recorded in History.</span>}
        footer={<A.Button size="sm" icon="sliders-horizontal" onClick={() => ui.open("profile-custom")} disabled={disk.readonly}>Custom profile…</A.Button>}>
        <div className="choice-list">
          {["standard", "hardened", "paranoid"].map((id) => {
            const p = PROFILES[id];
            return <Choice key={id} selected={m.profile === id} onClick={() => choose(id)} disabled={disk.readonly} title={p.name} badge={id === "hardened" ? <A.Badge size="sm" tone="accent">Recommended</A.Badge> : null} description={p.blurb} meta={<span className="mono-small">{describe(p)} · unlock {p.unlock}</span>} />;
          })}
          {isCustom(m) && <Choice selected onClick={() => ui.open("profile-custom")} title={P.name} badge={<A.Badge size="sm">Custom</A.Badge>} description="Your own parameters." meta={<span className="mono-small">{describe(P)} · unlock {fmtSec(estimate(P))}</span>} />}
          {m.profile === "legacy" && <Choice selected title="Legacy" badge={<A.Badge size="sm" tone="danger">Costs 20 health</A.Badge>} description={PROFILES.legacy.blurb} meta={<span className="mono-small">{describe(PROFILES.legacy)}</span>} />}
        </div>
      </Card>
      <Card title="Cipher" cli="pm cinfo" description="Both are authenticated. Pick XChaCha20 if you move the vault between very different machines."
        footNote={<span className="mono-small">{describe(P)} · {m.cipher} · {P.nonce}-byte nonce · {P.salt}-byte salt</span>}>
        <div className="cipher-grid">
          {CIPHERS.map((c) => (
            <button key={c.value} type="button" className={cx("cipher", m.cipher === c.value && "is-on")} aria-pressed={m.cipher === c.value ? "true" : "false"} disabled={disk.readonly} onClick={() => { if (m.cipher !== c.value) ui.open("reencrypt", { profile: m.profile, cipher: c.value }); }}>
              <span className="cipher-top"><b className="mono">{c.label}</b>{m.cipher === c.value && <A.Badge size="sm" tone="success" dot>In use</A.Badge>}</span>
              <span>{c.note}</span>
            </button>
          ))}
        </div>
      </Card>
      <Policies />
    </>
  );
}

function Policies() {
  const disk = useStore((s) => s.disk);
  const cur = activePolicy(disk);
  const [open, setOpen] = React.useState(null);
  return (
    <Card title="Password policy" description="Rules checked when you add or change a login. Loaded from YAML files in the policies folder next to pm." flush cli={cur ? "pm policy load " + cur.name : "pm policy list"}
      footNote={cur ? <Status tone="accent">Enforcing “{cur.name}”</Status> : "No policy. Any password is accepted, and Watchtower still flags weak ones."}
      footer={cur ? <A.Button size="sm" variant="ghost" onClick={async () => { const r = await act.policy(null); if (r.ok) ui.toast({ title: "Policy cleared", tone: "neutral" }); }}>Clear policy</A.Button> : null}>
      {disk.policies.length === 0 && <div className="card-empty">No policy files found. Add YAML files to the policies folder, then reopen Settings.</div>}
      {disk.policies.map((p) => {
        const on = cur && cur.name === p.name;
        return (
          <div key={p.name} className={cx("policy", on && "is-on")}>
            <button type="button" className="policy-row" onClick={() => setOpen(open === p.name ? null : p.name)} aria-expanded={open === p.name ? "true" : "false"}>
              <A.Icon name="scroll-text" size={16} />
              <span className="policy-name"><b className="mono">{p.name}</b><span className="muted small">{p.min_length || 0}+ characters{p.rotate_every_days ? " · rotate every " + p.rotate_every_days + " days" : ""}</span></span>
              <span className="grow" />
              {on ? <A.Badge size="sm" tone="accent" dot>Active</A.Badge> : <A.Button size="sm" onClick={async (e) => { e.stopPropagation(); const r = await act.policy(p.name); if (r.ok) ui.toast({ title: "Enforcing “" + p.name + "”" }); }}>Use</A.Button>}
              <A.Icon name={open === p.name ? "chevron-up" : "chevron-down"} size={14} className="muted" />
            </button>
            {open === p.name && (
              <div className="policy-rules">
                {[["Minimum length", (p.min_length || 0) + " characters"], ["Uppercase letter", p.require_uppercase ? "Required" : "Optional"], ["Number", p.require_numbers ? "Required" : "Optional"], ["Symbol", p.require_symbols ? "Required" : "Optional"], ["Rotation", p.rotate_every_days ? "Every " + p.rotate_every_days + " days" : "Not required"]].map(([k, v]) => <div key={k} className="kv"><div className="kv-label">{k}</div><div className="kv-value">{v}</div></div>)}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function TouchIdDialog({ onClose }) {
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    if (!pw) return;
    setBusy(true); setErr(null);
    const r = await act.touchIdSet(true, pw);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    ui.toast({ title: "Touch ID is on", description: "Next time, unlock with your fingerprint.", icon: "fingerprint" });
    onClose();
  };
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="fingerprint" title="Set up Touch ID" description="Confirm your master password. macOS stores it in the Keychain and asks for your fingerprint before releasing it."
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={!pw} onClick={go}>Turn on Touch ID</A.Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); go(); }}>
        <A.Input label="Master password" type="password" icon="lock" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} invalid={!!err} hint={err} autoFocus autoComplete="current-password" />
      </form>
    </A.Dialog>
  );
}

function ChangePasswordDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const [cur, setCur] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [cf, setCf] = React.useState("");
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    if (!passwordOk(pw, cf)) return;
    if (pw === cur) { setErr("The new password must be different."); return; }
    setBusy(true);
    const r = await act.changePassword(cur, pw);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    ui.toast({ title: "Master password changed", description: disk.auth.touchId ? "Touch ID keeps working. The Keychain entry was updated." : "Use it the next time you unlock.", icon: "key-round" });
    onClose();
  };
  return (
    <A.Dialog open onClose={busy ? undefined : onClose} size="md" icon="key-round" title="Change master password" description="The vault is re-encrypted with a key from the new password. Recovery methods keep working."
      footer={<><A.Button onClick={onClose} disabled={busy}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={!cur || !passwordOk(pw, cf)} onClick={go}>Change password</A.Button></>}>
      <form className="stack-16" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <A.Input label="Current master password" type="password" icon="lock" value={cur} onChange={(e) => { setCur(e.target.value); setErr(null); }} invalid={!!err} hint={err} autoFocus autoComplete="current-password" />
        <div className="divider" />
        <NewPasswordFields value={pw} confirm={cf} onValue={setPw} onConfirm={setCf} />
      </form>
    </A.Dialog>
  );
}

function ReencryptDialog({ profile, cipher, custom, onClose }) {
  const disk = useStore((s) => s.disk);
  const m = disk.meta;
  const from = profileOf(m);
  const to = custom || (profile === "custom" ? from : PROFILES[profile]);
  const toCipher = cipher || (custom ? custom.cipher : profile === m.profile ? m.cipher : to.cipher);
  const [phase, setPhase] = React.useState("ask");
  const [err, setErr] = React.useState(null);
  const run = async () => {
    setPhase("run"); setErr(null);
    const c = custom || (profile === "custom" ? from : null);
    const r = await act.setProfile(profile === "custom" || custom ? "custom" : profile, c ? { name: c.name || "Custom", kdf: "Argon2id", time: c.time, memory: c.memory, threads: c.threads, saltLen: c.salt, nonceLen: c.nonce, cipher: toCipher } : null, toCipher);
    if (!r.ok) { setPhase("ask"); setErr(r.error); return; }
    setPhase("done");
  };
  const row = (label, a, b) => <div className="cmp-row"><span className="cmp-l">{label}</span><span className="mono-small">{a}</span><A.Icon name="arrow-right" size={12} className="muted" /><span className={cx("mono-small", a !== b && "cmp-new")}>{b}</span></div>;
  return (
    <A.Dialog open onClose={phase === "run" ? undefined : onClose} size="md" icon={phase === "done" ? "circle-check" : "shield"} tone={phase === "done" ? "success" : undefined}
      title={phase === "done" ? "Vault re-encrypted" : "Re-encrypt with " + (to.name || "custom") + "?"}
      description={phase === "done" ? "Unlocks now take " + fmtSec(estimate(to)) + "." : "Every item is decrypted and encrypted again with new parameters. Keep the app open until it finishes."}
      footer={phase === "ask" ? <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" onClick={run}>Re-encrypt vault</A.Button></> : phase === "done" ? <A.Button variant="primary" onClick={onClose}>Done</A.Button> : null}>
      <div className="cmp">
        {row("Key derivation", from.kdf, to.kdf)}
        {row("Time cost", String(from.time), String(to.time))}
        {row("Memory", from.memory ? from.memory + " MiB" : "none", to.memory ? to.memory + " MiB" : "none")}
        {row("Threads", String(from.threads), String(to.threads))}
        {row("Cipher", m.cipher, toCipher)}
        {row("Unlock time", fmtSec(estimate(from)), fmtSec(estimate(to)))}
      </div>
      {phase === "run" && <div className="derive"><div className="derive-row"><b>Re-encrypting {U.n(disk.items.length, "item")}</b><span className="mono-small">{describe(to)}</span></div><div className="lock-bar"><i /></div></div>}
      {phase === "ask" && to.memory >= 512 && <A.Callout tone="warning" title="Needs 512 MiB free to unlock">Older or busy machines may take several seconds. pm on a small VPS may fail to unlock.</A.Callout>}
      {err && <div className="apm-hint apm-hint-danger apm-hint-enter" role="alert"><A.Icon name="triangle-alert" size={14} />{err}</div>}
    </A.Dialog>
  );
}

function CustomProfileDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const base = isCustom(disk.meta) ? profileOf(disk.meta) : PROFILES.hardened;
  const [p, setP] = React.useState({ name: isCustom(disk.meta) ? base.name : "My profile", kdf: "Argon2id", time: base.time, memory: base.memory, threads: base.threads, salt: base.salt, nonce: base.nonce, cipher: base.cipher, unlock: "" });
  const set = (k) => (v) => setP(Object.assign({}, p, { [k]: v }, k === "cipher" ? { nonce: v === "XChaCha20-Poly1305" ? 24 : 12 } : {}));
  const est = estimate(p);
  const tone = est > 2.5 ? "warning" : "success";
  return (
    <A.Dialog open onClose={onClose} size="md" icon="sliders-horizontal" title="Custom profile" description="Same knobs as pm profile create. Parameters are stored in the vault header so any copy of pm can unlock it."
      footerStart={<span className={cx("est", "is-" + tone)}><A.Icon name="timer" size={13} />Unlock {fmtSec(est)} on this Mac</span>}
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" disabled={!p.name.trim()} onClick={() => ui.open("reencrypt", { profile: "custom", custom: Object.assign({}, p, { name: p.name.trim(), unlock: fmtSec(est) }) })}>Continue</A.Button></>}>
      <div className="stack-16">
        <A.Input label="Name" value={p.name} onChange={(e) => set("name")(e.target.value)} maxLength={32} />
        <Knob label="Time cost" hint="Passes over memory" min={1} max={10} value={p.time} onChange={set("time")} fmt={(v) => v} />
        <Knob label="Memory" hint="Per guess" min={64} max={1024} step={64} value={p.memory} onChange={set("memory")} fmt={(v) => v + " MiB"} />
        <Knob label="Parallelism" hint="Threads" min={1} max={8} value={p.threads} onChange={set("threads")} fmt={(v) => v} />
        <div className="grid-2">
          <A.Select label="Salt" value={String(p.salt)} onChange={(v) => set("salt")(Number(v))} options={[{ value: "16", label: "16 bytes" }, { value: "32", label: "32 bytes" }]} />
          <A.Select label="Cipher" value={p.cipher} onChange={set("cipher")} options={CIPHERS.map((c) => ({ value: c.value, label: c.label }))} />
        </div>
      </div>
    </A.Dialog>
  );
}

function Knob({ label, hint, min, max, step, value, onChange, fmt }) {
  const id = "k-" + label.replace(/\s/g, "");
  return (
    <div className="knob">
      <label htmlFor={id} className="knob-label"><b>{label}</b><span>{hint}</span></label>
      <A.Slider id={id} label={label} min={min} max={max} step={step || 1} value={value} onChange={onChange} />
      <span className="knob-value mono">{fmt(value)}</span>
    </div>
  );
}

register("change-password", ChangePasswordDialog);
register("touchid-setup", TouchIdDialog);
register("reencrypt", ReencryptDialog);
register("profile-custom", CustomProfileDialog);
