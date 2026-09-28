import { A } from "../lib/ds.js";
import U from "../lib/util.js";
import { useStore } from "../lib/store.js";
import { ui, useUi } from "../lib/ui.js";
import { General, Alerts, About, SpacesSettings } from "./general.jsx";
import { Security } from "./security.jsx";
import { RecoverySettings } from "./recovery.jsx";
import { Sessions } from "./sessions.jsx";
import { Appearance } from "./appearance.jsx";
import { Sync } from "./sync.jsx";
import { Passkeys } from "./passkeys.jsx";
import { AiAccess } from "./ai.jsx";
import { ImportExport, Developer, Maintenance } from "./data.jsx";

const cx = U.cx;

export const SECTIONS = [
  { group: "Vault", items: [
    { id: "general", label: "General", icon: "settings", keys: "name path version update behavior copy confirm density" },
    { id: "security", label: "Security", icon: "shield", keys: "master password touch id auto lock clipboard profile argon2 cipher encryption policy" },
    { id: "recovery", label: "Recovery", icon: "life-buoy", keys: "email recovery key codes passkey quorum trustee shares forgot" },
    { id: "sessions", label: "Sessions", icon: "clock", keys: "read-only ephemeral agent ci session revoke" }
  ] },
  { group: "App", items: [
    { id: "appearance", label: "Appearance", icon: "palette", keys: "theme dark light custom colors nord dracula density" },
    { id: "spaces", label: "Spaces", icon: "layers", keys: "space work family rename delete color" },
    { id: "alerts", label: "Alerts", icon: "bell", keys: "security alerts email anomaly level" }
  ] },
  { group: "Connections", items: [
    { id: "sync", label: "Sync", icon: "cloud", keys: "cloud github google drive dropbox apmignore conflict diff" },
    { id: "passkeys", label: "Passkeys and extension", icon: "fingerprint", keys: "passkey browser extension bridge pairing token webauthn" },
    { id: "ai", label: "AI access", icon: "bot", keys: "mcp claude cursor tokens approvals transactions" }
  ] },
  { group: "Data", items: [
    { id: "import", label: "Import and export", icon: "arrow-up-down", keys: "import export csv json bitwarden 1password backup" },
    { id: "developer", label: "Developer", icon: "terminal", keys: "inject env apminject shell cli zsh completions" },
    { id: "maintenance", label: "Maintenance", icon: "eraser", keys: "cleanup prune storage destroy reset danger" }
  ] },
  { group: null, items: [{ id: "about", label: "About", icon: "info", keys: "version license shortcuts prototype" }] }
];
const ALL = SECTIONS.flatMap((g) => g.items);

export function Settings({ theme, onTheme }) {
  const u = useUi();
  const disk = useStore((s) => s.disk);
  const [q, setQ] = React.useState("");
  const cur = ALL.find((x) => x.id === u.route.section) ? u.route.section : "general";
  const scroller = React.useRef(null);
  React.useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; try { history.replaceState(null, "", "#settings-" + cur); } catch (e) {} }, [cur]);
  const match = (x) => !q || (x.label + " " + x.keys).toLowerCase().includes(q.toLowerCase());
  const pendingAi = disk.mcp.tx.filter((t) => t.status === "pending").length;
  const badge = { ai: pendingAi ? String(pendingAi) : null };
  const body = {
    general: <General />, security: <Security />, recovery: <RecoverySettings />, sessions: <Sessions />,
    appearance: <Appearance theme={theme} onTheme={onTheme} />, spaces: <SpacesSettings />, alerts: <Alerts />,
    sync: <Sync />, passkeys: <Passkeys />, ai: <AiAccess />,
    import: <ImportExport />, developer: <Developer />, maintenance: <Maintenance />, about: <About />
  }[cur];
  return (
    <div className="settings">
      <nav className="settings-nav" aria-label="Settings">
        <div className="settings-nav-top drag"><span className="nodrag settings-nav-title">Settings</span></div>
        <div className="settings-nav-search"><A.SearchField size="sm" placeholder="Find a setting" value={q} onChange={setQ} shortcut={null} /></div>
        <div className="settings-nav-scroll">
          {SECTIONS.map((g, gi) => {
            const items = g.items.filter(match);
            if (!items.length) return null;
            return (
              <div key={gi} className="settings-nav-group">
                {g.group && <div className="settings-nav-label">{g.group}</div>}
                {items.map((x) => <A.NavItem key={x.id} icon={x.icon} label={x.label} active={cur === x.id} badge={badge[x.id] ? { tone: "accent", text: badge[x.id] } : null} onClick={() => { ui.go({ view: "settings", section: x.id }); }} />)}
              </div>
            );
          })}
          {!ALL.some(match) && <div className="settings-nav-empty">No settings match “{q}”</div>}
        </div>
      </nav>
      <div className="settings-body" ref={scroller}>
        <div className="page-bar drag" />
        <div className="settings-inner" key={cur}>{body}</div>
      </div>
    </div>
  );
}
