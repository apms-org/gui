import { useStore, store, A as act } from "./lib/store.js";
import { ui } from "./lib/ui.js";
import { A } from "./lib/ds.js";
import { PRESETS, applyTheme } from "./lib/themes.js";
import { Welcome, Setup, Lock, Recovery, CloudRestore, OpenVault } from "./screens/auth.jsx";
import { Shell } from "./screens/shell.jsx";

const resolveTheme = (prefs) => {
  const id = prefs.theme || "system";
  if (id === "system") return { id: "system" };
  return PRESETS.find((p) => p.id === id) || (prefs.customThemes || []).find((t) => t.id === id) || { id: "system" };
};

function useSystemDark() {
  const q = React.useMemo(() => window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null, []);
  const [dark, setDark] = React.useState(q ? q.matches : true);
  React.useEffect(() => { if (!q) return; const f = (e) => setDark(e.matches); q.addEventListener ? q.addEventListener("change", f) : q.addListener(f); return () => { q.removeEventListener ? q.removeEventListener("change", f) : q.removeListener(f); }; }, [q]);
  return dark;
}

function Boot() {
  return <div className="boot drag" aria-busy="true"><A.Mark tile size={48} className="boot-mark" /></div>;
}

function Fatal({ message }) {
  return (
    <div className="boot drag">
      <div className="boot-fatal nodrag">
        <A.Mark tile size={48} />
        <h1 className="title-2">APM could not start</h1>
        <p className="muted">{message}</p>
        {window.apm && <A.Button variant="primary" icon="rotate-ccw" onClick={() => window.apm.app.relaunch()}>Restart APM</A.Button>}
      </div>
    </div>
  );
}

function App() {
  const S = useStore();
  const prefs = S.prefs;
  const sysDark = useSystemDark();
  const theme = resolveTheme(prefs);
  const [base, setBase] = React.useState(() => applyTheme(theme, sysDark));
  const [screen, setScreen] = React.useState(null);
  const key = (theme.id || "") + JSON.stringify(theme.c || {}) + sysDark;
  React.useLayoutEffect(() => { setBase(applyTheme(theme, sysDark)); }, [key]);
  React.useEffect(() => { document.documentElement.setAttribute("data-density", prefs.density || "comfortable"); }, [prefs.density]);
  React.useEffect(() => { act.boot(); }, []);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (!S.session.unlocked) return;
    if (screen) setScreen(null);
    const hashed = first.current && location.hash.length > 1;
    first.current = false;
    if (hashed) return;
    const o = S.disk && S.disk.settings.openOnLaunch;
    if (o === "fav") ui.go({ view: "vault", filter: "fav" });
    else if (o === "authenticator") ui.go({ view: "authenticator" });
    else if (o === "last" && prefs.view) ui.go({ view: prefs.view });
    else ui.go({ view: "vault", filter: "all" });
  }, [S.session.unlocked]);
  React.useEffect(() => { document.title = S.disk && S.session.unlocked ? S.disk.meta.name + " · APM" : S.status && S.status.exists ? "Locked · APM" : "APM"; }, [S.disk && S.disk.meta.name, S.session.unlocked, S.status && S.status.exists]);
  React.useEffect(() => {
    if (!window.apm || !window.apm.menu) return;
    let last = "";
    const push = () => {
      const u = ui.get();
      const next = { locked: !S.session.unlocked, hasSelection: !!(S.session.unlocked && u.route.view === "vault" && u.selected) };
      const key = JSON.stringify(next);
      if (key !== last) { last = key; window.apm.menu.setState(next); }
    };
    push();
    return ui.subscribe(push);
  }, [S.session.unlocked]);
  const onTheme = () => store.savePrefs({ theme: base === "dark" ? "light" : "dark" });

  if (S.phase === "boot") return <Boot />;
  if (S.phase === "fatal") return <Fatal message={S.fatal} />;
  const exists = !!(S.status && S.status.exists);
  const back = () => setScreen(null);
  if (screen === "setup" && !S.session.unlocked) return <Setup onCancel={() => setScreen(exists ? "welcome" : null)} />;
  if (screen === "restore" && !S.session.unlocked) return <CloudRestore onCancel={() => setScreen(exists ? "welcome" : null)} onDone={back} />;
  if (screen === "open" && !S.session.unlocked) return <OpenVault onCancel={() => setScreen(exists ? "welcome" : null)} />;
  if (!exists || screen === "welcome") {
    return <Welcome onCreate={() => setScreen("setup")} onRestore={() => setScreen("restore")} onOpen={() => setScreen("open")} onBack={exists ? Object.assign(back, { label: act.lockInfo().name }) : null} />;
  }
  if (!S.session.unlocked) {
    if (screen === "recover") return <Recovery onDone={back} onCancel={back} />;
    return <Lock onRecover={() => setScreen("recover")} onWelcome={() => setScreen("welcome")} theme={base} onTheme={onTheme} />;
  }
  if (!S.disk) return <Boot />;
  return <Shell theme={base} onTheme={onTheme} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
