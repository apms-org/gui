import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore, A as act } from "../lib/store.js";
import { ui, saveFile } from "../lib/ui.js";
import { register } from "../lib/registry.js";
import { OtpInput } from "../screens/auth.jsx";
import { Card, Head } from "./common.jsx";
import { Cli } from "../ui/kit.jsx";

const cx = U.cx;

function ErrorLine({ children }) {
  if (!children) return null;
  return <A.Hint tone="danger" icon="triangle-alert">{children}</A.Hint>;
}

export function RecoverySettings() {
  const disk = useStore((s) => s.disk);
  const r = disk.recovery;
  const codes = r.codes || { total: 0, unused: 0 };
  const methods = [
    { id: "email", icon: "mail", title: "Recovery email and key", on: !!(r.email && r.emailVerified), desc: r.email ? r.email + " · a code sent here plus your recovery key resets the password" : "Verify an email and APM creates your recovery key.", action: r.email ? "Change" : "Set up", dialog: "rec-email", cli: "pm auth email" },
    { id: "key", icon: "key-square", title: "Recovery key", on: !!r.key, desc: r.key ? "Set up" + (r.keyCreated ? " · created " + U.date(r.keyCreated) : "") + ". Replacing it resets trustee shares." : "Created when you verify a recovery email.", action: r.key ? "Replace key" : "Create key", dialog: "rec-key", cli: "pm auth recover", needs: !r.email },
    { id: "codes", icon: "list", title: "One-time codes", on: codes.unused > 0, warn: codes.total > 0 && codes.unused <= 3, desc: codes.total ? codes.unused + " of " + codes.total + " unused" + (r.codesCreated ? " · created " + U.date(r.codesCreated) : "") : "Single-use codes, each good for one reset.", action: codes.total ? "New set" : "Generate", dialog: "rec-codes", cli: "pm auth codes generate" },
    { id: "passkey", icon: "fingerprint", title: "Recovery passkey", on: !!r.passkey, desc: r.passkey ? "Registered. Your browser asks for it during recovery." : "Prove it is you with Touch ID or a security key, through your browser.", action: r.passkey ? "Remove" : "Set up", dialog: "rec-passkey", cli: "pm auth passkey register" },
    { id: "quorum", icon: "users", title: "Trustee shares", on: !!r.quorum, desc: r.quorum ? "Any " + r.quorum.threshold + " of " + r.quorum.shares + " trustees can restore access" + (r.quorum.created ? " · since " + U.date(r.quorum.created) : "") : "Split a recovery secret between people you trust.", action: r.quorum ? "Split again" : "Set up", dialog: "rec-quorum", cli: "pm auth quorum-setup", needs: !r.key }
  ];
  const ready = methods.filter((x) => x.on).length;
  const tone = ready >= 3 ? "success" : ready >= 1 ? "warning" : "danger";
  return (
    <>
      <Head title="Recovery" description="Ways back in if you forget your master password. Each one unlocks a copy of the vault key that is encrypted separately, so none of them weakens the vault." cli="pm auth recover" />
      <div className={cx("coverage", "is-" + tone)}>
        <div className="coverage-top">
          <b>{ready === 0 ? "No way back in" : ready + " of 5 methods ready"}</b>
          <span className="muted">{ready >= 3 ? "Losing any one device or person will not lock you out." : ready >= 1 ? "Add another method so a single loss cannot lock you out." : "If you forget your password, this vault cannot be opened by anyone."}</span>
        </div>
        <div className="coverage-bar" aria-hidden="true">{methods.map((x) => <i key={x.id} className={cx(x.on && "is-on", x.warn && "is-warn")} />)}</div>
      </div>
      <Card flush>
        {methods.map((x) => (
          <div key={x.id} className="method">
            <span className={cx("method-icon", x.on && "is-on")}><A.Icon name={x.icon} size={16} /></span>
            <div className="method-text">
              <div className="method-top"><b>{x.title}</b>{x.on ? <A.Badge size="sm" tone={x.warn ? "warning" : "success"} dot>{x.warn ? "Running low" : "Ready"}</A.Badge> : <A.Badge size="sm" outline>Not set up</A.Badge>}</div>
              <span className="method-desc">{x.desc}</span>
            </div>
            <Cli cmd={x.cli} className="method-cli" />
            <A.Button size="sm" variant={x.on ? "secondary" : "primary"} disabled={disk.readonly || (x.needs && !x.on)} title={x.needs && !x.on ? (x.id === "key" ? "Add a recovery email first" : "Create a recovery key first") : undefined} onClick={() => ui.open(x.dialog)}>{x.action}</A.Button>
          </div>
        ))}
      </Card>
      <Card danger title="Remove all recovery data" description="Deletes every recovery method above. After this, only your master password opens the vault."
        cli="pm auth reset"
        footer={<A.Button size="sm" variant="danger" disabled={!ready || disk.readonly} onClick={() => ui.open("confirm", { title: "Remove all recovery data?", description: "Your email, recovery key, one-time codes, passkey and trustee shares stop working immediately.", icon: "triangle-alert", tone: "danger", confirm: "Remove everything", word: "REMOVE", onConfirm: async () => { const res = await act.resetRecovery(); if (res.ok) ui.toast({ title: "Recovery data removed", tone: "neutral" }); } })}>Remove recovery data</A.Button>} />
    </>
  );
}

function EmailDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const [email, setEmail] = React.useState("");
  const [step, setStep] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [key, setKey] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const send = async () => {
    setBusy(true); setErr(null);
    const r = await act.recoveryEmailStart(email.trim());
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setStep(1); setTyped("");
  };
  const verify = async () => {
    setBusy(true); setErr(null);
    const r = await act.recoveryEmailVerify(typed);
    setBusy(false);
    if (!r.ok) { setErr(r.code === "invalid" ? "That code does not match. It expires 15 minutes after sending." : r.error); return; }
    if (r.key) { setKey(r.key); setStep(2); return; }
    ui.toast({ title: "Recovery email verified", description: email, icon: "mail" });
    onClose();
  };
  if (step === 2) return (
    <A.Dialog open onClose={saved ? onClose : undefined} size="md" icon="key-square" title="Your recovery key" description={"Email verified. Together with a code sent to " + email + ", this key resets your master password. It is shown once."}
      footerStart={<A.Checkbox checked={saved} onChange={setSaved} label="I stored it somewhere safe" />}
      footer={<A.Button variant="primary" disabled={!saved} onClick={() => { ui.toast({ title: "Recovery is set up", icon: "life-buoy" }); onClose(); }}>Done</A.Button>}>
      <div className="stack-12">
        <div className="reckey-big">{key.split("-").map((g, i) => <span key={i}>{g}</span>)}</div>
        <div className="row-gap-8">
          <A.Button size="sm" icon="copy" onClick={() => { act.copyValue(key, 60); ui.toast({ title: "Copied recovery key", tone: "neutral", icon: "copy" }); }}>Copy</A.Button>
          <A.Button size="sm" icon="file-down" onClick={() => saveFile("apm-recovery-key.txt", "APM recovery key\n" + disk.meta.name + "\nCreated " + new Date().toISOString() + "\n\n" + key + "\n", "text/plain")}>Save as .txt</A.Button>
        </div>
        {disk.recovery.quorum && <A.Callout tone="warning" title="Trustee shares were reset">They were split from the old key. Set them up again in Recovery.</A.Callout>}
      </div>
    </A.Dialog>
  );
  return (
    <A.Dialog open onClose={onClose} size="sm" icon="mail" title={step ? "Check your email" : "Recovery email"} description={step ? "APM sent a 6-digit code to " + email + "." : "Verifying it creates your recovery key. Used only for recovery codes and the alerts you turn on."}
      footer={step ? <><A.Button onClick={() => { setStep(0); setTyped(""); setErr(null); }}>Back</A.Button><A.Button variant="primary" loading={busy} disabled={typed.length !== 6} onClick={verify}>Verify</A.Button></> : <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={!valid} onClick={send}>Send code</A.Button></>}>
      {step === 0 ? <form onSubmit={(e) => { e.preventDefault(); if (valid) send(); }}><A.Input label="Email" type="email" icon="mail" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus placeholder="you@example.com" /></form> : (
        <div className="stack-16">
          <OtpInput value={typed} onChange={setTyped} invalid={!!err} autoFocus />
          <A.Button variant="link" onClick={send} disabled={busy}>Send a new code</A.Button>
        </div>
      )}
      <ErrorLine>{err}</ErrorLine>
    </A.Dialog>
  );
}

function KeyDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const had = disk.recovery.key;
  const [key, setKey] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const make = async () => { setBusy(true); const k = await act.newRecoveryKey(); setBusy(false); if (k) setKey(k); };
  return (
    <A.Dialog open onClose={key && !saved ? undefined : onClose} size="md" icon="key-square" title={key ? "Your recovery key" : had ? "Replace recovery key?" : "Create a recovery key"}
      description={key ? "This is the only time it is shown. Store it somewhere offline, like a printed page in a safe." : had ? "Your current key stops working as soon as the new one is created." : "Together with a code sent to your recovery email, this key can reset your master password. Keep it offline."}
      footerStart={key ? <A.Checkbox checked={saved} onChange={setSaved} label="I stored it somewhere safe" /> : null}
      footer={key ? <A.Button variant="primary" disabled={!saved} onClick={() => { ui.toast({ title: "Recovery key saved", icon: "key-square" }); onClose(); }}>Done</A.Button> : <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant={had ? "danger" : "primary"} loading={busy} onClick={make}>{had ? "Replace key" : "Create key"}</A.Button></>}>
      {key && (
        <div className="stack-12">
          <div className="reckey-big">{key.split("-").map((g, i) => <span key={i}>{g}</span>)}</div>
          <div className="row-gap-8">
            <A.Button size="sm" icon="copy" onClick={() => { act.copyValue(key, 60); ui.toast({ title: "Copied recovery key", tone: "neutral", icon: "copy" }); }}>Copy</A.Button>
            <A.Button size="sm" icon="file-down" onClick={() => saveFile("apm-recovery-key.txt", "APM recovery key\n" + disk.meta.name + "\nCreated " + new Date().toISOString() + "\n\n" + key + "\n", "text/plain")}>Save as .txt</A.Button>
          </div>
        </div>
      )}
    </A.Dialog>
  );
}

function CodesDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const cur = disk.recovery.codes || { total: 0 };
  const [n, setN] = React.useState(10);
  const [codes, setCodes] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const text = codes ? "APM one-time recovery codes\n" + disk.meta.name + "\n\n" + codes.map((c, i) => String(i + 1).padStart(2, " ") + ". " + c).join("\n") + "\n\nEach code works once.\n" : "";
  const make = async () => { setBusy(true); const c = await act.newCodes(n); setBusy(false); if (c) setCodes(c); };
  return (
    <A.Dialog open onClose={onClose} size="md" icon="list" title={codes ? "Your one-time codes" : "Generate one-time codes"} description={codes ? "Each code works once. Cross them off as you use them." : cur.total ? "Your " + cur.total + " current codes stop working." : "Each code can stand in as the second factor during recovery."}
      footer={codes ? <A.Button variant="primary" onClick={onClose}>Done</A.Button> : <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} onClick={make}>Generate {n} codes</A.Button></>}>
      {!codes && <A.SegmentedControl label="How many" value={n} onChange={setN} options={[{ value: 6, label: "6 codes" }, { value: 10, label: "10 codes" }, { value: 16, label: "16 codes" }]} />}
      {codes && (
        <div className="stack-12">
          <div className="codes-grid">{codes.map((c, i) => <div key={c} className="code-cell"><span className="code-n">{i + 1}</span><span className="mono">{c}</span></div>)}</div>
          <div className="row-gap-8">
            <A.Button size="sm" icon="copy" onClick={() => { act.copyValue(codes.join("\n"), 60); ui.toast({ title: "Copied " + codes.length + " codes", tone: "neutral", icon: "copy" }); }}>Copy all</A.Button>
            <A.Button size="sm" icon="file-down" onClick={() => saveFile("apm-recovery-codes.txt", text, "text/plain")}>Save as .txt</A.Button>
          </div>
        </div>
      )}
    </A.Dialog>
  );
}

function PasskeyDialog({ onClose }) {
  const disk = useStore((s) => s.disk);
  const on = disk.recovery.passkey;
  const [phase, setPhase] = React.useState("ask");
  const [err, setErr] = React.useState(null);
  const go = async () => { setPhase("touch"); setErr(null); const r = await act.recoveryPasskey(true); if (r.ok) setPhase("done"); else { setPhase("ask"); setErr(r.error); } };
  const remove = async () => { const r = await act.recoveryPasskey(false); if (r.ok) { ui.toast({ title: "Recovery passkey removed", tone: "neutral" }); onClose(); } else setErr(r.error); };
  if (on && phase === "ask") return (
    <A.Dialog open onClose={onClose} size="sm" icon="fingerprint" tone="danger" title="Remove the recovery passkey?" description="You will not be able to recover with it. Other methods keep working."
      footer={<><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="danger" onClick={remove}>Remove passkey</A.Button></>}><ErrorLine>{err}</ErrorLine></A.Dialog>
  );
  return (
    <A.Dialog open onClose={phase === "touch" ? undefined : onClose} size="sm" icon="fingerprint" tone={phase === "done" ? "success" : undefined} title={phase === "done" ? "Passkey registered" : "Set up a recovery passkey"}
      description={phase === "done" ? "During recovery, your browser asks for this passkey as the second factor." : "APM opens a local page in your browser. Your browser creates the passkey with Touch ID, iCloud Keychain or a security key."}
      footer={phase === "done" ? <A.Button variant="primary" onClick={onClose}>Done</A.Button> : phase === "ask" ? <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" icon="fingerprint" onClick={go}>Continue in browser</A.Button></> : null}>
      {phase === "touch" && <div className="touch-wait"><span className="touch-ring"><A.Icon name="fingerprint" size={30} /></span><span>Finish in your browser. This window updates when it is done.</span></div>}
      <ErrorLine>{err}</ErrorLine>
    </A.Dialog>
  );
}

function QuorumDialog({ onClose }) {
  const [shares, setShares] = React.useState(3);
  const [threshold, setThreshold] = React.useState(2);
  const [list, setList] = React.useState(null);
  const [names, setNames] = React.useState(["", "", "", "", "", "", "", ""]);
  const [busy, setBusy] = React.useState(false);
  const [needKey, setNeedKey] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [err, setErr] = React.useState(null);
  const t = Math.min(threshold, shares);
  const make = async () => {
    setBusy(true); setErr(null);
    const r = await act.newQuorum(t, shares, key.trim());
    setBusy(false);
    if (r.ok) { setList(r.shares || []); return; }
    if (r.data && r.data.needKey) { setNeedKey(true); setErr(key ? "That recovery key does not match this vault." : null); return; }
    setErr(r.error);
  };
  return (
    <A.Dialog open onClose={onClose} size="md" icon="users" title={list ? "Hand out the shares" : "Trustee shares"}
      description={list ? "Give one share to each person, in private. No single share reveals anything." : "Shamir secret sharing splits your recovery key so that any " + t + " of " + shares + " people together can restore access, and fewer learn nothing."}
      footer={list ? <A.Button variant="primary" onClick={onClose}>Done</A.Button> : <><A.Button onClick={onClose}>Cancel</A.Button><A.Button variant="primary" loading={busy} disabled={needKey && !key.trim()} onClick={make}>Create {shares} shares</A.Button></>}>
      {!list ? (
        <div className="stack-16">
          <div className="knob"><label className="knob-label" htmlFor="q-n"><b>Trustees</b><span>People who each hold a share</span></label><A.Slider id="q-n" label="Trustees" min={2} max={8} value={shares} onChange={(v) => { setShares(v); if (threshold > v) setThreshold(v); }} /><span className="knob-value mono">{shares}</span></div>
          <div className="knob"><label className="knob-label" htmlFor="q-t"><b>Needed to recover</b><span>Minimum shares</span></label><A.Slider id="q-t" label="Threshold" min={2} max={shares} value={t} onChange={setThreshold} /><span className="knob-value mono">{t}</span></div>
          <div className="quorum-viz" aria-hidden="true">{Array.from({ length: shares }).map((_, i) => <span key={i} className={cx(i < t && "is-need")}><A.Icon name="user-round" size={14} /></span>)}<span className="quorum-cap">{t} of {shares}</span></div>
          {needKey && <A.Input label="Recovery key" icon="key-round" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" className="mono-input" autoFocus hint="The shares encode your recovery key, so APM needs it once." />}
          <ErrorLine>{err}</ErrorLine>
        </div>
      ) : (
        <div className="shares">
          {list.map((s, i) => (
            <div key={s} className="share">
              <input className="share-name" placeholder={"Trustee " + (i + 1)} value={names[i]} onChange={(e) => { const n = names.slice(); n[i] = e.target.value; setNames(n); }} aria-label={"Trustee " + (i + 1) + " name"} />
              <span className="mono share-val">{s.slice(0, 18)}…</span>
              <A.IconButton icon="copy" label="Copy share" size="xs" onClick={() => { act.copyValue(s, 60); ui.toast({ title: "Copied share " + (i + 1), tone: "neutral", icon: "copy" }); }} />
            </div>
          ))}
        </div>
      )}
    </A.Dialog>
  );
}

register("rec-email", EmailDialog);
register("rec-key", KeyDialog);
register("rec-codes", CodesDialog);
register("rec-passkey", PasskeyDialog);
register("rec-quorum", QuorumDialog);
