import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { A as act, useStore } from "../lib/store.js";
import { PROFILES, CIPHERS, recommendProfile, describe, PASSWORD_RULES } from "../lib/profiles.js";
import { saveFile } from "../lib/ui.js";
import LINKS from "../../../electron/links.json";

const cx = U.cx;

function Traffic() {
  return <div className="traffic" aria-hidden="true"><i /><i /><i /></div>;
}

function AuthFrame({ children, footer, wide, grid = true }) {
  return (
    <div className="auth drag">
      {grid && <div className="auth-grid" aria-hidden="true" />}
      <div className={cx("auth-stack nodrag", wide && "is-wide")}>{children}</div>
      {footer && <div className="auth-foot nodrag">{footer}</div>}
    </div>
  );
}

function ErrorLine({ children }) {
  if (!children) return null;
  return <A.Hint tone="danger" icon="triangle-alert">{children}</A.Hint>;
}

export function OtpInput({ length = 6, value, onChange, invalid, autoFocus }) {
  const refs = React.useRef([]);
  const chars = (value || "").split("");
  const set = (i, ch) => { const next = chars.slice(); next[i] = ch; onChange(next.join("").slice(0, length)); };
  return (
    <div className={cx("otp", invalid && "is-invalid")} role="group" aria-label="Verification code">
      {Array.from({ length }).map((_, i) => (
        <input key={i} ref={(n) => (refs.current[i] = n)} inputMode="numeric" maxLength={1} aria-label={"Digit " + (i + 1)} autoFocus={autoFocus && i === 0} value={chars[i] || ""}
          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(-1); set(i, d); if (d && refs.current[i + 1]) refs.current[i + 1].focus(); }}
          onKeyDown={(e) => { if (e.key === "Backspace" && !chars[i] && refs.current[i - 1]) refs.current[i - 1].focus(); if (e.key === "ArrowLeft" && refs.current[i - 1]) refs.current[i - 1].focus(); if (e.key === "ArrowRight" && refs.current[i + 1]) refs.current[i + 1].focus(); }}
          onPaste={(e) => { const p = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, length); if (p) { e.preventDefault(); onChange(p); const n = refs.current[Math.min(p.length, length - 1)]; n && n.focus(); } }}
        />
      ))}
    </div>
  );
}

function RulesList({ value }) {
  return (
    <ul className="rules">
      {PASSWORD_RULES.map((r) => { const ok = r.test(value); return <li key={r.id} className={ok ? "is-ok" : ""}><A.Icon name={ok ? "circle-check" : "circle-dot"} size={14} />{r.label}</li>; })}
    </ul>
  );
}

export function NewPasswordFields({ value, confirm, onValue, onConfirm, autoFocus }) {
  const s = U.strength(value);
  const suggest = () => { const p = U.generate({ mode: "passphrase", words: 4, separator: "-", capitalize: true, number: true }) + "!"; onValue(p); onConfirm(p); };
  const mismatch = confirm && confirm !== value;
  return (
    <div className="stack-16">
      <div className="stack-8">
        <A.Input label="Master password" type="password" value={value} onChange={(e) => onValue(e.target.value)} autoFocus={autoFocus} autoComplete="new-password" size="lg" icon="lock"
          trailing={<A.Button size="sm" variant="ghost" icon="dices" onClick={suggest}>Suggest</A.Button>} />
        {value && <div className="pw-meter"><A.StrengthMeter score={s.score} bits={s.bits} detail={U.crackPhrase(s.bits)} /></div>}
      </div>
      <RulesList value={value} />
      <A.Input label="Confirm master password" type="password" value={confirm} onChange={(e) => onConfirm(e.target.value)} autoComplete="new-password" size="lg" icon="lock" invalid={!!mismatch} hint={mismatch ? "The passwords do not match." : null} />
    </div>
  );
}
export const passwordOk = (v, c) => PASSWORD_RULES.every((r) => r.test(v)) && v === c;

export const tildify = (p) => String(p || "").replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, "~");

export function Welcome({ onCreate, onRestore, onOpen, onBack }) {
  const status = useStore((s) => s.status) || {};
  return (
    <AuthFrame footer={<><span /><a href={LINKS.docs} target="_blank" rel="noreferrer">Documentation</a></>}>
      <A.Mark tile size={64} className="auth-mark" />
      <h1 className="display auth-title">Welcome to APM</h1>
      <p className="auth-sub">One encrypted vault for every secret you have. It lives on this Mac, and only you can open it.</p>
      <div className="welcome-choices">
        <A.ChoiceTile variant="list" arrow icon="plus" title="Create a new vault" description="Set a master password and pick how hard the key is to crack." onClick={onCreate} />
        <A.ChoiceTile variant="list" arrow icon="folder-open" title="Open an existing vault" description="Choose a vault.dat made by pm or another Mac." onClick={onOpen} />
        <A.ChoiceTile variant="list" arrow icon="cloud-upload" title="Restore from cloud" description="Download your vault from Google Drive, GitHub or Dropbox." onClick={onRestore} />
      </div>
      {onBack && <button type="button" className="auth-link" onClick={onBack}><A.Icon name="arrow-left" size={14} />Back to {onBack.label || "your vault"}</button>}
    </AuthFrame>
  );
}

export function OpenVault({ onCancel }) {
  const status = useStore((s) => s.status) || {};
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const pick = async () => {
    setErr(null);
    const paths = await window.apm.dialog.open({ title: "Open a vault", filters: [{ name: "APM vault", extensions: ["dat", "vault"] }, { name: "All files", extensions: ["*"] }] });
    if (!paths || !paths[0]) return;
    setBusy(true);
    try {
      await window.apm.app.setVaultPath(paths[0]);
      const st = await act.refreshStatus();
      if (!st || !st.exists) { setErr("That file could not be read as an APM vault."); setBusy(false); return; }
      onCancel();
    } catch (e) { setErr((e && e.message) || "Could not open that file."); setBusy(false); }
  };
  const useDefault = async () => {
    setBusy(true);
    try { const p = await window.apm.app.defaultVaultPath(); await window.apm.app.setVaultPath(p); await act.refreshStatus(); onCancel(); } catch (e) { setErr((e && e.message) || "Could not switch vaults."); setBusy(false); }
  };
  return (
    <AuthFrame wide>
      <div className="rec-head">
        <span className="rec-icon"><A.Icon name="folder-open" size={20} /></span>
        <h1 className="title-1">Open a vault</h1>
        <p className="auth-sub">APM works on one vault.dat at a time. pm uses the same file when you point it there with APM_VAULT_PATH or --vault.</p>
      </div>
      <div className="rec-card">
        <A.KeyValueList>
          <A.KeyValue label="Current file" mono>{tildify(status.path) || "none"}</A.KeyValue>
          <A.KeyValue label="State">{status.exists ? "Vault found" : "No vault at this path yet"}</A.KeyValue>
        </A.KeyValueList>
        <ErrorLine>{err}</ErrorLine>
        <div className="rec-foot">
          <A.Button variant="ghost" icon="arrow-left" onClick={onCancel} disabled={busy}>Back</A.Button>
          <div className="rec-foot-end">
            <A.Button variant="ghost" onClick={useDefault} disabled={busy}>Use the default location</A.Button>
            <A.Button variant="primary" icon="folder-open" loading={busy} onClick={pick}>Choose vault file</A.Button>
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}

const SETUP_STEPS = ["Password", "Security", "Spaces", "Unlock", "Create", "Recovery", "Sync"];

export function Setup({ onCancel }) {
  const status = useStore((s) => s.status) || {};
  const disk = useStore((s) => s.disk);
  const [step, setStep] = React.useState(0);
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const cores = navigator.hardwareConcurrency || 8;
  const ram = navigator.deviceMemory ? Math.max(navigator.deviceMemory, 8) : 16;
  const rec = recommendProfile(ram, cores);
  const [profile, setProfile] = React.useState(rec);
  const [custom, setCustom] = React.useState({ name: "Custom", kdf: "Argon2id", time: 4, memory: 128, threads: 4, salt: 32, nonce: 12, cipher: "AES-256-GCM" });
  const [cipher, setCipher] = React.useState(PROFILES[rec].cipher);
  const [spaces, setSpaces] = React.useState(["Personal", "Work"]);
  const [spaceInput, setSpaceInput] = React.useState("");
  const tidAvailable = !!(status.touchId && status.touchId.available);
  const [touchId, setTouchId] = React.useState(tidAvailable);
  const [timeout, setTimeoutV] = React.useState("60");
  const [inactivity, setInactivity] = React.useState("15");
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [err, setErr] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [recKey, setRecKey] = React.useState(null);
  const [savedKey, setSavedKey] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [provider, setProvider] = React.useState("none");
  const [repo, setRepo] = React.useState("");
  const [token, setToken] = React.useState("");
  const [finished, setFinished] = React.useState(false);

  const P = profile === "custom" ? custom : PROFILES[profile];
  const chosenCipher = profile === "custom" ? custom.cipher : cipher;
  const canNext = [passwordOk(pw, pw2), true, true, true, created, !email || !sent || (verified && (!recKey || savedKey)), true][step];
  const addSpace = () => { const n = spaceInput.trim(); if (n && !spaces.some((s) => s.toLowerCase() === n.toLowerCase())) setSpaces(spaces.concat([n])); setSpaceInput(""); };

  const create = async () => {
    setCreating(true); setErr(null);
    const t0 = Date.now();
    const est = P.memory >= 512 ? 4000 : P.memory >= 256 ? 2600 : 1600;
    const tick = setInterval(() => setProgress(Math.min(0.94, (Date.now() - t0) / est)), 60);
    const r = await act.createVault({ password: pw, name: "Personal vault", profile: profile === "custom" ? "custom" : profile, custom: profile === "custom" ? { time: custom.time, memory: custom.memory, threads: custom.threads, saltLen: custom.salt, nonceLen: custom.nonce, cipher: custom.cipher } : null, cipher: chosenCipher, touchId: touchId && tidAvailable, spaces, alerts: false, hold: true });
    clearInterval(tick);
    if (!r.ok) { setCreating(false); setProgress(0); setErr(r.error); return; }
    setProgress(1);
    await act.settings({ sessionTimeout: timeout, inactivity });
    setCreated(true); setCreating(false);
  };
  const send = async () => {
    setBusy(true); setErr(null);
    const r = await act.recoveryEmailStart(email.trim());
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setSent(true); setCode(""); setVerified(false);
  };
  const verify = async (v) => {
    setCode(v);
    if (v.length !== 6) return;
    setBusy(true); setErr(null);
    const r = await act.recoveryEmailVerify(v);
    setBusy(false);
    if (!r.ok) { setErr(r.code === "invalid" ? "That code does not match. Check the email and try again." : r.error); return; }
    setVerified(true);
    if (r.key) setRecKey(r.key);
  };
  const makeKey = async () => { setBusy(true); const k = await act.newRecoveryKey(); setBusy(false); if (k) setRecKey(k); };
  const connect = async () => {
    if (provider === "none") { setFinished(true); return; }
    setBusy(true); setErr(null);
    const r = await act.syncConnect(provider === "github" ? { provider, mode: "pat", token, repo } : { provider, mode: "self_hosted" });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setFinished(true);
  };
  const next = () => { setErr(null); if (step === 6) { connect(); return; } setStep(step + 1); };

  const body = [
    <div className="stack-20" key="pw">
      <NewPasswordFields value={pw} confirm={pw2} onValue={setPw} onConfirm={setPw2} autoFocus />
      <A.Callout tone="warning" title="APM cannot reset this password">It never leaves this Mac and is never stored. Set up recovery after the vault is created so you have a way back in.</A.Callout>
    </div>,
    <div className="stack-20" key="sec">
      <div className="hw"><A.Icon name="cpu" size={16} /><span>This Mac has <b>{cores} cores</b> and <b>{ram} GB</b> of memory, so APM recommends <b>{PROFILES[rec].name}</b>.</span></div>
      <A.ChoiceGroup columns={1} label="Encryption profile">
        {["standard", "hardened", "paranoid"].map((id) => { const p = PROFILES[id]; return (
          <A.ChoiceTile variant="list" key={id} selected={profile === id} onClick={() => { setProfile(id); setCipher(p.cipher); }} icon={id === "standard" ? "shield" : id === "hardened" ? "shield-check" : "lock-keyhole"} title={p.name} badge={id === rec ? <A.Badge tone="accent" size="sm">Recommended</A.Badge> : null} description={p.blurb} meta={describe(p) + " · unlock " + p.unlock} />
        ); })}
        <A.ChoiceTile variant="list" selected={profile === "custom"} onClick={() => setProfile("custom")} icon="sliders-horizontal" title="Custom" description="Set Argon2id memory, time, threads, salt and nonce yourself." meta={profile === "custom" ? describe(custom) : null} />
      </A.ChoiceGroup>
      {profile === "custom" && (
        <div className="custom-profile">
          <div className="slider-row"><label htmlFor="cp-mem">Memory</label><A.Slider id="cp-mem" label="Memory" min={32} max={1024} step={32} value={custom.memory} onChange={(v) => setCustom({ ...custom, memory: v })} /><span className="mono">{custom.memory} MiB</span></div>
          <div className="slider-row"><label htmlFor="cp-time">Time cost</label><A.Slider id="cp-time" label="Time" min={1} max={10} value={custom.time} onChange={(v) => setCustom({ ...custom, time: v })} /><span className="mono">t={custom.time}</span></div>
          <div className="slider-row"><label htmlFor="cp-thr">Threads</label><A.Slider id="cp-thr" label="Threads" min={1} max={16} value={custom.threads} onChange={(v) => setCustom({ ...custom, threads: v })} /><span className="mono">p={custom.threads}</span></div>
          <div className="grid-2">
            <A.Select label="Salt length" value={String(custom.salt)} onChange={(v) => setCustom({ ...custom, salt: Number(v) })} options={["16", "24", "32", "64"].map((x) => ({ value: x, label: x + " bytes" }))} />
            <A.Select label="Nonce length" value={String(custom.nonce)} onChange={(v) => setCustom({ ...custom, nonce: Number(v) })} options={["12", "24"].map((x) => ({ value: x, label: x + " bytes" }))} />
          </div>
        </div>
      )}
      <div className="stack-8">
        <div className="label-row"><span className="apm-label">Cipher</span></div>
        <A.SegmentedControl label="Cipher" options={CIPHERS.map((c) => ({ value: c.value, label: c.label }))} value={chosenCipher} onChange={(v) => (profile === "custom" ? setCustom({ ...custom, cipher: v, nonce: v === "XChaCha20-Poly1305" ? 24 : custom.nonce }) : setCipher(v))} />
        <p className="help">{CIPHERS.find((c) => c.value === chosenCipher).note}</p>
      </div>
    </div>,
    <div className="stack-20" key="spaces">
      <p className="help-lg">Spaces keep work and personal secrets apart. Every vault has a Default space; add as many as you like. You can rename or remove them later.</p>
      <div className="space-chips">
        <span className="space-chip is-fixed"><A.Icon name="layers" size={13} />Default</span>
        {spaces.map((s) => <span className="space-chip" key={s}>{s}<button type="button" aria-label={"Remove " + s} onClick={() => setSpaces(spaces.filter((x) => x !== s))}><A.Icon name="x" size={12} /></button></span>)}
      </div>
      <div className="inline-add">
        <A.Input placeholder="Add a space, like Family or Homelab" value={spaceInput} onChange={(e) => setSpaceInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSpace(); } }} />
        <A.Button onClick={addSpace} disabled={!spaceInput.trim()}>Add</A.Button>
      </div>
      <div className="suggest-row">{["Family", "Homelab", "Clients", "Finance"].filter((s) => !spaces.includes(s)).map((s) => <button type="button" key={s} className="suggest" onClick={() => setSpaces(spaces.concat([s]))}><A.Icon name="plus" size={12} />{s}</button>)}</div>
    </div>,
    <div className="stack-20" key="unlock">
      <A.FieldGroup>
        <A.SettingRow icon="fingerprint" title="Unlock with Touch ID" description={tidAvailable ? "Stores your master password in the macOS Keychain, protected by your fingerprint." : "Touch ID is not available on this Mac."}>
          <A.Switch checked={touchId && tidAvailable} onChange={setTouchId} label="Unlock with Touch ID" disabled={!tidAvailable} />
        </A.SettingRow>
        <A.SettingRow icon="clock" title="Session length" description="How long an unlock lasts, even while you are active.">
          <A.Select size="sm" value={timeout} onChange={setTimeoutV} options={[{ value: "15", label: "15 minutes" }, { value: "60", label: "1 hour" }, { value: "240", label: "4 hours" }, { value: "720", label: "12 hours" }]} />
        </A.SettingRow>
        <A.SettingRow icon="timer" title="Lock when idle" description="Locks after this long without activity.">
          <A.Select size="sm" value={inactivity} onChange={setInactivity} options={[{ value: "1", label: "1 minute" }, { value: "5", label: "5 minutes" }, { value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" }]} />
        </A.SettingRow>
      </A.FieldGroup>
      <p className="help">APM also locks when your Mac sleeps or the screen locks. Change that in Settings, Security.</p>
    </div>,
    <div className="stack-20" key="review">
      <A.FieldGroup>
        <A.KeyValueList>
          <A.KeyValue label="Vault file" mono>{tildify(status.path)}</A.KeyValue>
          <A.KeyValue label="Profile">{profile === "custom" ? "Custom" : P.name} <span className="muted">· {describe(P)}</span></A.KeyValue>
          <A.KeyValue label="Cipher" mono>{chosenCipher}</A.KeyValue>
          <A.KeyValue label="Spaces">{["Default"].concat(spaces).join(", ")}</A.KeyValue>
          <A.KeyValue label="Touch ID">{touchId && tidAvailable ? "On" : "Off"}</A.KeyValue>
          <A.KeyValue label="Lock">{"After " + inactivity + " min idle, " + (Number(timeout) >= 60 ? Number(timeout) / 60 + " h" : timeout + " min") + " max"}</A.KeyValue>
        </A.KeyValueList>
      </A.FieldGroup>
      {(creating || created) && <div className="derive"><div className="derive-row"><b>{created ? "Vault created" : "Deriving your key"}</b><span className="mono-small">{describe(P)}</span></div><A.Progress value={progress * 100} /></div>}
      {!creating && !created && <p className="help">Recovery and sync come next. Both are optional.</p>}
    </div>,
    <div className="stack-20" key="rec">
      <p className="help-lg">If you forget your master password, a code sent to your email plus a recovery key gets you back in. Without them, a forgotten password means a lost vault.</p>
      {!recKey ? (
        <div className="stack-16">
          <div className="inline-add">
            <A.Input label="Recovery email" type="email" icon="mail" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); setVerified(false); }} disabled={verified} />
            <A.Button onClick={send} loading={busy && !sent} disabled={!/^\S+@\S+\.\S+$/.test(email) || verified} style={{ alignSelf: "flex-end" }}>{sent ? "Resend" : "Send code"}</A.Button>
          </div>
          {sent && !verified && (
            <div className="stack-12">
              <div className="mail-preview"><A.Icon name="mail" size={14} /><span>APM sent a 6-digit code to {email}. It expires in 15 minutes.</span></div>
              <OtpInput value={code} onChange={verify} invalid={!!err && code.length === 6} autoFocus />
            </div>
          )}
          {verified && <A.Button variant="primary" icon="key-round" loading={busy} onClick={makeKey}>Create recovery key</A.Button>}
        </div>
      ) : (
        <div className="stack-16">
          <A.Callout tone="success" title="Email verified">{email}</A.Callout>
          <div className="reckey">
            <div className="reckey-label">Your recovery key</div>
            <div className="reckey-value">{recKey}</div>
            <div className="reckey-actions">
              <A.Button size="sm" icon="copy" onClick={() => act.copyValue(recKey, 60)}>Copy</A.Button>
              <A.Button size="sm" icon="download" onClick={() => saveFile("APM-recovery-key.txt", "APM recovery key\n\n" + recKey + "\n\nVault: " + (disk ? disk.meta.name : "Personal vault") + "\nCreated: " + new Date().toLocaleString() + "\n", "text/plain")}>Save as file</A.Button>
            </div>
          </div>
          <A.Checkbox checked={savedKey} onChange={setSavedKey} label="I stored this key somewhere safe" description="It is shown once. APM keeps only a wrapped copy that this key unlocks." />
        </div>
      )}
      {!sent && <p className="help">You can skip this and set it up later in Settings, Recovery.</p>}
    </div>,
    <div className="stack-20" key="sync">
      <p className="help-lg">Sync uploads only the sealed vault file. Providers never see your master password or your items.</p>
      <A.ChoiceGroup columns={1} label="Sync provider">
        <A.ChoiceTile variant="list" selected={provider === "none"} onClick={() => setProvider("none")} icon="hard-drive" title="Keep it on this Mac" description="No network. You can add a provider any time." />
        <A.ChoiceTile variant="list" selected={provider === "github"} onClick={() => setProvider("github")} icon="git-branch" title="GitHub" description="Commits vault.dat to a private repository you own." />
        <A.ChoiceTile variant="list" selected={provider === "gdrive"} onClick={() => setProvider("gdrive")} icon="cloud" title="Google Drive" description="Your own Drive, through a browser sign-in." />
        <A.ChoiceTile variant="list" selected={provider === "dropbox"} onClick={() => setProvider("dropbox")} icon="archive" title="Dropbox" description="Your own Dropbox app, through a browser sign-in." />
      </A.ChoiceGroup>
      {provider === "github" && <div className="stack-12">
        <A.Input label="Repository" placeholder="owner/repo" icon="git-branch" value={repo} onChange={(e) => setRepo(e.target.value)} hint="A private repository you own." />
        <A.Input label="Personal access token" type="password" placeholder="github_pat_..." icon="key-round" value={token} onChange={(e) => setToken(e.target.value)} hint="Contents: read and write on that repository." />
      </div>}
      {(provider === "gdrive" || provider === "dropbox") && <A.Callout tone="accent" title="Your browser opens next">APM asks for access to a single app folder, then uploads the encrypted file.</A.Callout>}
    </div>
  ];

  const titles = [
    ["Create your master password", "The one password you will remember. It encrypts everything else."],
    ["Choose how hard your key is to crack", "Argon2id makes every guess cost memory and time. More is safer and slower to unlock."],
    ["Organize with spaces", "Separate groups inside your vault, each with its own items."],
    ["Unlocking", "How APM opens, and when it locks itself."],
    ["Review and create", "Check the choices below. You can change all of them later."],
    ["Set up recovery", "A way back in if you ever forget your master password."],
    ["Sync, if you want it", "Keep an encrypted copy somewhere else. Optional."]
  ];
  const syncReady = provider !== "github" || (/^[\w.-]+\/[\w.-]+$/.test(repo) && token.length > 8);

  if (finished) {
    return (
      <div className="setup">
        <Traffic />
        <aside className="setup-rail drag">
          <div className="setup-brand nodrag"><A.Mark tile size={28} /><span>APM</span></div>
          <ol className="setup-steps nodrag">{SETUP_STEPS.map((s) => <li key={s} className="is-done"><button type="button" disabled><span className="setup-dot"><A.Icon name="check" size={11} strokeWidth={3} /></span>{s}</button></li>)}</ol>
        </aside>
        <main className="setup-main">
          <div className="setup-body setup-done" key="done">
            <span className="done-badge"><A.Icon name="check" size={24} strokeWidth={2.5} /></span>
            <h1 className="setup-title">Your vault is ready</h1>
            <p className="setup-desc">Encrypted with {describe(P)} and {chosenCipher}. Here is what most people do next.</p>
            <div className="next-grid">
              <A.ChoiceTile variant="list" arrow icon="download" title="Import passwords" description="From a CSV, JSON or otpauth export." onClick={() => { act.enter(); setTimeout(() => window.dispatchEvent(new CustomEvent("apm:open", { detail: { name: "import" } })), 50); }} />
              <A.ChoiceTile variant="list" arrow icon="plus" title="Add your first item" description="A login, a card, an SSH key, anything." onClick={() => { act.enter(); setTimeout(() => window.dispatchEvent(new CustomEvent("apm:open", { detail: { name: "new" } })), 50); }} />
              <A.ChoiceTile variant="list" arrow icon="puzzle" title="Connect the browser extension" description="Fill logins, codes and passkeys in Chrome, Arc or Brave." onClick={() => { act.enter(); setTimeout(() => window.dispatchEvent(new CustomEvent("apm:go", { detail: { view: "settings", section: "passkeys" } })), 50); }} />
            </div>
            <A.Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => act.enter()}>Open vault</A.Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="setup">
      <Traffic />
      <aside className="setup-rail drag">
        <div className="setup-brand nodrag"><A.Mark tile size={28} /><span>APM</span></div>
        <ol className="setup-steps nodrag">
          {SETUP_STEPS.map((s, i) => (
            <li key={s} className={i < step ? "is-done" : i === step ? "is-current" : ""}>
              <button type="button" disabled={i > step || creating || (created && i <= 4)} onClick={() => setStep(i)}>
                <span className="setup-dot">{i < step ? <A.Icon name="check" size={11} strokeWidth={3} /> : i + 1}</span>{s}
                {(i === 5 || i === 6) && <span className="setup-opt">Optional</span>}
              </button>
            </li>
          ))}
        </ol>
        <p className="setup-note nodrag"><A.Icon name="hard-drive" size={13} />Everything stays on this Mac unless you turn on sync.</p>
      </aside>
      <main className="setup-main">
        <div className="setup-body" key={step}>
          <div className="setup-count">Step {step + 1} of {SETUP_STEPS.length}</div>
          <h1 className="setup-title">{titles[step][0]}</h1>
          <p className="setup-desc">{titles[step][1]}</p>
          <div className="setup-content">{body[step]}<ErrorLine>{err}</ErrorLine></div>
        </div>
        <footer className="setup-foot">
          {created ? <span /> : <A.Button variant="ghost" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))} disabled={creating}>{step === 0 ? "Cancel" : "Back"}</A.Button>}
          <div className="setup-foot-end">
            {(step === 5 || step === 6) && <A.Button variant="ghost" disabled={busy} onClick={() => { setErr(null); if (step === 5) setStep(6); else setFinished(true); }}>Skip</A.Button>}
            {step === 4 && !created ? <A.Button variant="primary" icon="lock" loading={creating} onClick={create}>Create vault</A.Button>
              : <A.Button variant="primary" iconRight="arrow-right" loading={busy && step === 6} disabled={!canNext || (step === 6 && !syncReady) || busy} onClick={next}>{step === 6 ? (provider === "none" ? "Finish" : "Connect and finish") : "Continue"}</A.Button>}
          </div>
        </footer>
      </main>
    </div>
  );
}

let autoTouchTried = false;

const touchApi = () => (window.apm && window.apm.touchId) || null;

// Whether this Mac runs Touch ID inline on the lock screen: the app embeds
// macOS's Touch ID glyph in the button and no system dialog appears. null
// until the app answers.
function useTouchInline() {
  const [inline, setInline] = React.useState(touchApi() ? null : false);
  React.useEffect(() => {
    const t = touchApi();
    if (!t) return;
    let live = true;
    t.info().then((r) => { if (live) setInline(!!(r && r.inline)); }, () => { if (live) setInline(false); });
    return () => { live = false; };
  }, []);
  return inline;
}

export function Lock({ onRecover, onWelcome, theme, onTheme }) {
  const session = useStore((s) => s.session);
  useStore((s) => s.status);
  const info = act.lockInfo();
  const [pw, setPw] = React.useState("");
  const [error, setError] = React.useState(null);
  const [shake, setShake] = React.useState(null);
  const [phase, setPhase] = React.useState("idle");
  const [wait, setWait] = React.useState(0);
  const [menu, setMenu] = React.useState(false);
  const [ro, setRo] = React.useState(false);
  const inline = useTouchInline();
  const [glyph, setGlyph] = React.useState(false);
  const touchBtn = React.useRef(null);
  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  const roRef = React.useRef(ro);
  roRef.current = ro;
  // After a fingerprint is rejected or Touch ID locks out, stop re-arming on
  // focus until the button is pressed.
  const touchHeld = React.useRef(false);
  const dark = theme === "dark";
  const P = info.profile || { kdf: "Argon2id", memory: 64, cipher: "AES-256-GCM", time: 3, threads: 2 };
  React.useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => { setWait(wait - 1); if (wait - 1 <= 0) setError(null); }, 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const finish = () => { setPhase("open"); setTimeout(() => act.enter({ readonly: roRef.current ? 15 : 0 }), 640); };
  const submit = async (v) => {
    if ((phase !== "idle" && phase !== "touch") || wait > 0) return;
    if (!v) { setShake(Date.now()); return; }
    if (phase === "touch" && touchApi()) touchApi().cancel();
    setPhase("deriving"); setError(null);
    const r = await act.unlock(v);
    if (r.ok) { finish(); return; }
    setPhase("idle"); setPw(""); setShake(Date.now());
    if (inline && r.error !== "cooldown" && r.error !== "breach" && !touchHeld.current) setTimeout(() => touch(true), 100);
    if (r.error === "cooldown") { setWait(r.wait); setError("Too many attempts. Try again in " + r.wait + " seconds."); }
    else if (r.error === "wrong") setError(r.left != null ? "Incorrect password. " + r.left + " attempt" + (r.left === 1 ? "" : "s") + " left before a wait." : "Incorrect password.");
    else setError(r.message || "Could not unlock the vault.");
  };
  const touch = async (auto) => {
    if (!info.touchId || phaseRef.current !== "idle") return;
    if (!auto) { touchHeld.current = false; setError(null); }
    setPhase("touch");
    const started = Date.now();
    const r = await act.touchId();
    if (r.ok) { finish(); return; }
    setPhase((p) => (p === "touch" ? "idle" : p));
    if (r.code === "touchid_cancelled") {
      // Focus can come back before pm reports the cancel, so re-arm here. A
      // cancel that comes straight back means the app refused to arm; leave it.
      if (inline && Date.now() - started > 500) setTimeout(() => { if (document.hasFocus() && !touchHeld.current) touch(true); }, 100);
      return;
    }
    if (inline) touchHeld.current = true;
    else if (auto && r.code === "touchid_failed") return;
    setError(r.code === "touchid_failed" ? (inline ? "Touch ID did not recognise that fingerprint. Enter your master password." : "Touch ID was cancelled. Enter your master password.") : r.message);
  };
  // Inline Touch ID tells the app where the glyph goes: over the button's
  // fingerprint icon, followed every frame so it tracks layout changes.
  React.useEffect(() => {
    const t = touchApi();
    if (!t || !inline || !info.touchId) return;
    let raf = 0;
    let last = "";
    const track = () => {
      const icon = touchBtn.current && touchBtn.current.querySelector(".apm-icon");
      const r = icon && icon.getBoundingClientRect();
      const slot = r && r.width > 0 ? { x: r.left, y: r.top, width: r.width, height: r.height, dark } : null;
      const key = JSON.stringify(slot);
      if (key !== last) { last = key; t.slot(slot); }
      raf = requestAnimationFrame(track);
    };
    track();
    return () => { cancelAnimationFrame(raf); t.slot(null); };
  }, [inline, info.touchId, dark]);
  React.useEffect(() => (window.apm && window.apm.on ? window.apm.on("touchid.inline", (d) => setGlyph(!!(d && d.on))) : undefined), []);
  // Like the macOS lock screen, inline Touch ID is armed whenever this window
  // has focus. Without it, the system dialog is offered once per launch.
  React.useEffect(() => {
    if (inline === null || !info.touchId) return;
    if (!inline) {
      if (autoTouchTried || session.lockedAt) return;
      autoTouchTried = true;
      touch(true);
      return;
    }
    const arm = () => { if (document.hasFocus() && !touchHeld.current) touch(true); };
    arm();
    window.addEventListener("focus", arm);
    return () => window.removeEventListener("focus", arm);
  }, [inline, info.touchId]);
  const idle = session.lockedAt ? (session.lockReason === "idle" ? "Locked after a period of inactivity" : session.lockReason === "sleep" ? "Locked when your Mac went to sleep" : session.lockReason === "expired" ? "Locked when the session ended" : session.lockReason === "Locked from the browser" ? "Locked from the browser" : "Locked " + U.agoLong(session.lockedAt)) : "Locked";
  const unlockMs = P.memory >= 512 ? 1500 : P.memory >= 256 ? 1100 : 750;
  return (
    <AuthFrame footer={<>
      <span />
      <span className="auth-foot-end">
        <A.Menu open={menu} onOpenChange={setMenu} align="end" side="top" width={240} trigger={<button type="button" className="auth-footlink">More options<A.Icon name="chevron-up" size={12} /></button>}
          items={[{ label: "Unlock read-only for 15 minutes", icon: "eye", checked: ro, onSelect: () => setRo(!ro) }, { label: "Forgot master password", icon: "life-buoy", onSelect: onRecover }, { separator: true }, { label: "Open another vault", icon: "folder-open", onSelect: onWelcome }]} />
        <A.IconButton icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Light theme" : "Dark theme"} tipSide="top" onClick={onTheme} />
      </span>
    </>}>
      <div className={cx("lock-mark-wrap", phase === "open" && "is-open")}><A.Mark tile size={64} className="auth-mark" /></div>
      <div className={cx("lock-body", phase === "open" && "is-open")}>
        <h1 className="display auth-title">Unlock your vault</h1>
        <button type="button" className="lock-vault" title={info.path + " · click to open another vault"} onClick={onWelcome}><span className="dot" aria-hidden="true" /><span>{info.name}{info.count != null ? " · " + U.n(info.count, "item") : ""}</span></button>
        <div className="lock-form">
          <A.PasswordInput value={pw} onChange={(v) => { setPw(v); if (error && !wait) setError(null); }} onSubmit={submit} error={error} busy={phase === "deriving" || phase === "open" || wait > 0} autoFocus shakeKey={shake} />
          {info.touchId && <>
            <div className="lock-or">or</div>
            <A.Button ref={touchBtn} variant="secondary" size="lg" block icon="fingerprint" className={cx("lock-touch", phase === "touch" && "is-scanning", glyph && "has-glyph")} onClick={() => touch(false)} disabled={phase === "deriving" || phase === "open" || wait > 0}>{phase === "touch" ? "Touch the sensor" : "Unlock with Touch ID"}</A.Button>
          </>}
        </div>
        {phase === "deriving" || phase === "open" ? (
          <div className="derive"><div className="derive-row"><b>Deriving key</b><span className="mono-small">{describe(P)}</span></div><div className="lock-bar"><i style={{ animationDuration: unlockMs + "ms" }} /></div></div>
        ) : wait > 0 ? (
          <div className="lock-idle is-warning"><A.Icon name="clock" size={13} />Try again in {wait}s</div>
        ) : (
          <div className="lock-idle"><A.Icon name="clock" size={13} />{ro ? "Will open read-only for 15 minutes" : idle}</div>
        )}
      </div>
    </AuthFrame>
  );
}

export function Recovery({ onDone, onCancel }) {
  const status = useStore((s) => s.status) || {};
  const r = status.recovery || {};
  const codes = r.codes || { total: 0, unused: 0 };
  const hasKeyPath = !!((r.email || r.emailSet) && r.key);
  const hasFactor = !!(r.passkey || codes.unused > 0);
  const [mode, setMode] = React.useState(hasKeyPath ? "key" : "quorum");
  const [step, setStep] = React.useState(0);
  const [err, setErr] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [key, setKey] = React.useState("");
  const [factor, setFactor] = React.useState(r.passkey ? "passkey" : "code");
  const [otc, setOtc] = React.useState("");
  const [pkState, setPkState] = React.useState("idle");
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [shares, setShares] = React.useState(["", ""]);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  if (!hasKeyPath && !r.quorum) {
    return (
      <AuthFrame>
        <A.EmptyState icon="life-buoy" title="Recovery is not set up for this vault" action={<A.Button onClick={onCancel} icon="arrow-left">Back to unlock</A.Button>}>Without a recovery email and key, or trustee shares, APM has no way to open the vault. Try your master password again, or restore an older copy from sync.</A.EmptyState>
      </AuthFrame>
    );
  }
  const fail = (res) => { setBusy(false); setErr(res.error); };
  const next = async () => {
    setErr(null);
    if (mode === "key") {
      if (step === 0) { if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr("Enter the recovery email for this vault."); return; } setBusy(true); const res = await act.recoverEmailSend(email.trim()); if (!res.ok) return fail(Object.assign(res, { error: res.code === "invalid" ? "That is not the recovery email for this vault." : res.error })); setBusy(false); setStep(1); return; }
      if (step === 1) { if (code.length !== 6) { setErr("Enter the 6-digit code from the email."); return; } setBusy(true); const res = await act.recoverEmailVerify(code); if (!res.ok) return fail(Object.assign(res, { error: res.code === "invalid" ? "That code does not match. It expires 15 minutes after sending." : res.error })); setBusy(false); setStep(2); return; }
      if (step === 2) { setBusy(true); const res = await act.recoverVerify("key", key.trim()); if (!res.ok) return fail(Object.assign(res, { error: res.code === "invalid" || res.code === "wrong_password" ? "That recovery key is not correct." : res.error })); setBusy(false); setStep(res.needsFactor === false || !hasFactor ? 4 : 3); return; }
      if (step === 3) {
        if (factor === "code") { if (!otc.trim()) { setErr("Enter one of your one-time codes."); return; } setBusy(true); const res = await act.recoverVerify("code", otc.trim()); if (!res.ok) return fail(Object.assign(res, { error: res.code === "invalid" ? "That code is not valid or was already used." : res.error })); setBusy(false); setStep(4); return; }
        if (pkState !== "ok") { setErr("Confirm with your passkey first."); return; }
        setStep(4); return;
      }
    }
    if (mode === "quorum" && step === 0) {
      const filled = shares.map((s) => s.trim()).filter(Boolean);
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr("Enter the recovery email for this vault."); return; }
      if (filled.length < r.quorum.threshold) { setErr("Enter at least " + r.quorum.threshold + " shares."); return; }
      setBusy(true); const res = await act.recoverVerify("quorum", "", filled, email.trim()); if (!res.ok) return fail(Object.assign(res, { error: res.code === "invalid" ? "Those shares do not combine into this vault's recovery secret." : res.error })); setBusy(false); setStep(4); return;
    }
    if (step === 4) {
      if (!passwordOk(pw, pw2)) { setErr("The new password does not meet the rules yet."); return; }
      setBusy(true); const res = await act.recoverReset(pw); if (!res.ok) return fail(res); setBusy(false); setDone(true);
    }
  };
  const passkey = async () => { setPkState("wait"); setErr(null); const res = await act.recoverVerify("passkey"); if (res.ok) setPkState("ok"); else { setPkState("idle"); setErr(res.error); } };
  const steps = mode === "key" ? ["Email", "Code", "Recovery key", "Second factor", "New password"] : ["Trustee shares", "New password"];
  const idx = mode === "key" ? step : step === 4 ? 1 : 0;
  return (
    <AuthFrame wide>
      <div className="rec-head">
        <span className="rec-icon"><A.Icon name="life-buoy" size={20} /></span>
        <h1 className="title-1">{done ? "You are back in" : "Recover your vault"}</h1>
        <p className="auth-sub">{done ? "Your master password has been reset. Update Touch ID in Settings, Security if you use it." : mode === "key" ? "Prove it is you with your recovery email, recovery key and a second factor." : "Combine " + r.quorum.threshold + " of your " + r.quorum.shares + " trustee shares."}</p>
      </div>
      {!done && <A.Stepper layout="spread" items={steps} value={steps[idx]} />}
      {done ? (
        <A.Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => { act.enter(); onDone(); }}>Open vault</A.Button>
      ) : (
        <div className="rec-card">
          {mode === "key" && step === 0 && <A.Input label="Recovery email" type="email" icon="mail" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} placeholder="you@example.com" autoFocus hint={r.email ? "Hint: " + r.email + ". APM sends a 6-digit code there." : "APM sends a 6-digit code there."} />}
          {mode === "key" && step === 1 && <div className="stack-12"><div className="mail-preview"><A.Icon name="mail" size={14} /><span>Code sent to {email}. It expires in 15 minutes.</span></div><OtpInput value={code} onChange={setCode} autoFocus invalid={!!err} /></div>}
          {mode === "key" && step === 2 && <A.Input label="Recovery key" icon="key-round" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" autoFocus spellCheck={false} className="mono-input" />}
          {mode === "key" && step === 3 && (
            <div className="stack-16">
              {r.passkey && codes.unused > 0 ? <A.SegmentedControl label="Second factor" options={[{ value: "passkey", label: "Passkey", icon: "fingerprint" }, { value: "code", label: "One-time code", icon: "hash" }]} value={factor} onChange={setFactor} /> : null}
              {factor === "passkey" ? (
                <div className="pk-prompt">
                  <A.Icon name="fingerprint" size={28} />
                  <div><b>APM Recovery</b><span>Your browser opens and asks for the passkey you registered.</span></div>
                  <A.Button variant={pkState === "ok" ? "secondary" : "primary"} icon={pkState === "ok" ? "check" : undefined} loading={pkState === "wait"} onClick={passkey} disabled={pkState === "ok"}>{pkState === "ok" ? "Verified" : "Use passkey"}</A.Button>
                </div>
              ) : (
                <A.Input label="One-time recovery code" icon="hash" value={otc} onChange={(e) => setOtc(e.target.value.toUpperCase())} placeholder="A1B2C3-D4E5" autoFocus className="mono-input" hint={codes.unused + " of " + codes.total + " codes unused"} />
              )}
            </div>
          )}
          {mode === "quorum" && step === 0 && (
            <div className="stack-12">
              <A.Input label="Recovery email" type="email" icon="mail" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} placeholder="you@example.com" hint={r.email ? "Hint: " + r.email : null} />
              {shares.map((s, i) => <A.Input key={i} label={"Share " + (i + 1)} icon="users" value={s} onChange={(e) => { const n = shares.slice(); n[i] = e.target.value; setShares(n); }} placeholder="Paste a trustee share" className="mono-input" />)}
              {shares.length < r.quorum.shares && <A.Button variant="ghost" size="sm" icon="plus" onClick={() => setShares(shares.concat([""]))}>Add another share</A.Button>}
            </div>
          )}
          {step === 4 && <NewPasswordFields value={pw} confirm={pw2} onValue={setPw} onConfirm={setPw2} autoFocus />}
          <ErrorLine>{err}</ErrorLine>
          <div className="rec-foot">
            <A.Button variant="ghost" icon="arrow-left" onClick={onCancel} disabled={busy}>Back to unlock</A.Button>
            <div className="rec-foot-end">
              {step === 0 && r.quorum && hasKeyPath && <A.Button variant="ghost" onClick={() => { setMode(mode === "key" ? "quorum" : "key"); setErr(null); }}>{mode === "key" ? "Use trustee shares" : "Use recovery key"}</A.Button>}
              <A.Button variant="primary" iconRight={step === 4 ? undefined : "arrow-right"} loading={busy} onClick={next}>{step === 4 ? "Reset password" : mode === "key" && step === 0 ? "Send code" : "Continue"}</A.Button>
            </div>
          </div>
        </div>
      )}
    </AuthFrame>
  );
}

export function CloudRestore({ onCancel, onDone }) {
  const status = useStore((s) => s.status) || {};
  const [provider, setProvider] = React.useState("github");
  const [step, setStep] = React.useState(0);
  const [id, setId] = React.useState("");
  const [token, setToken] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [target, setTarget] = React.useState(null);
  const go = async () => {
    setErr(null);
    if (step === 0) {
      if (!id.trim()) { setErr(provider === "github" ? "Enter the repository as owner/repo." : "Enter the retrieval key."); return; }
      if (provider === "github" && !token.trim()) { setErr("Enter a token that can read the repository."); return; }
      if (status.exists && !target) {
        const p = await window.apm.dialog.save({ title: "Save the restored vault", defaultPath: "vault-restored.dat", filters: [{ name: "APM vault", extensions: ["dat"] }] });
        if (!p) return;
        setTarget(p);
      }
      setStep(1); return;
    }
    if (!pw) return;
    setBusy(true);
    if (target) { try { await window.apm.app.setVaultPath(target); await act.refreshStatus(); } catch (e) { setBusy(false); setErr((e && e.message) || "Could not use that location."); return; } }
    const r = await act.syncRestore(provider === "github" ? { provider, repo: id.trim(), token: token.trim(), password: pw, overwrite: !!target } : { provider, key: id.trim(), password: pw, overwrite: !!target });
    setBusy(false);
    if (!r.ok) {
      if (r.code === "wrong_password") { setErr("That is not the master password for the downloaded vault."); setPw(""); return; }
      setStep(0); setErr(r.error); return;
    }
    act.enter();
    onDone && onDone();
  };
  return (
    <AuthFrame wide>
      <div className="rec-head">
        <span className="rec-icon"><A.Icon name="cloud-upload" size={20} /></span>
        <h1 className="title-1">Restore from cloud</h1>
        <p className="auth-sub">APM downloads the sealed vault file, then asks for the master password it was created with.</p>
      </div>
      <A.Stepper layout="spread" items={["Find your vault", "Unlock it"]} value={["Find your vault", "Unlock it"][step]} />
      <div className="rec-card">
        {step === 0 ? (
          <div className="stack-16">
            <A.SegmentedControl label="Provider" options={[{ value: "github", label: "GitHub", icon: "git-branch" }, { value: "gdrive", label: "Google Drive", icon: "cloud" }, { value: "dropbox", label: "Dropbox", icon: "archive" }]} value={provider} onChange={(v) => { setProvider(v); setErr(null); }} />
            {provider === "github" ? <>
              <A.Input label="Repository" icon="git-branch" placeholder="owner/repo" value={id} onChange={(e) => setId(e.target.value)} autoFocus />
              <A.Input label="Personal access token" icon="key-round" type="password" placeholder="github_pat_..." value={token} onChange={(e) => setToken(e.target.value)} hint="Needs read access to the repository contents." />
            </> : <A.Input label="Retrieval key" icon="key-round" placeholder="Your retrieval key" value={id} onChange={(e) => setId(e.target.value)} autoFocus hint="The key shown when you set up sync. pm cloud init prints it too." />}
            {status.exists && <p className="help">A vault already exists at {tildify(status.path)}. The restored copy is saved to a new file you choose, and APM switches to it.</p>}
          </div>
        ) : (
          <div className="stack-16">
            <A.Callout tone="accent" title={"Ready to download from " + (provider === "github" ? id : provider === "gdrive" ? "Google Drive" : "Dropbox")}>{"Saved to " + tildify(target || status.path) + " once it decrypts."}</A.Callout>
            <A.PasswordInput value={pw} onChange={setPw} onSubmit={go} autoFocus busy={busy} error={err} />
          </div>
        )}
        {step === 0 && <ErrorLine>{err}</ErrorLine>}
        <div className="rec-foot">
          <A.Button variant="ghost" icon="arrow-left" onClick={() => (step === 0 ? onCancel() : setStep(0))} disabled={busy}>Back</A.Button>
          <A.Button variant="primary" loading={busy} iconRight="arrow-right" onClick={go} disabled={step === 1 && !pw}>{step === 0 ? "Continue" : "Download and unlock"}</A.Button>
        </div>
      </div>
    </AuthFrame>
  );
}
